/**
 * Self-contained public onboarding form page — plain HTML/CSS/vanilla JS,
 * no build step, no external requests. Served by OnboardNotifyPublicController
 * for candidates who have no HRMS account (see module doc for why this lives
 * on the backend rather than a new frontend package).
 *
 * The page shell always renders; it never itself knows whether the token is
 * valid. All state comes from calling the JSON API (guarded by
 * OnboardingTokenGuard) client-side, so an invalid/expired link renders a
 * friendly in-page message instead of a raw 404.
 */
export function renderOnboardingFormPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Onboarding Form</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; color: #1f2430; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
  header { padding: 8px 0 20px; }
  header h1 { font-size: 20px; margin: 0 0 4px; }
  header p { margin: 0; color: #5b6472; font-size: 14px; }
  .card { background: #fff; border: 1px solid #e3e6eb; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 14px; color: #1f2430; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 12.5px; color: #5b6472; margin-bottom: 4px; }
  .field input, .field select, .field textarea { width: 100%; padding: 9px 10px; border: 1px solid #d3d7de; border-radius: 7px; font-size: 14px; font-family: inherit; background: #fff; color: #1f2430; }
  .field textarea { resize: vertical; min-height: 60px; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .msg { padding: 14px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
  .msg.info { background: #eaf1ff; color: #1c4ed8; }
  .msg.error { background: #fdecea; color: #b3261e; }
  .msg.success { background: #e9f7ee; color: #146c2e; }
  .actions { position: sticky; bottom: 0; background: linear-gradient(to top, #f4f5f7 60%, transparent); padding: 16px 0 4px; }
  button { appearance: none; border: none; border-radius: 8px; padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button.primary { background: #1c4ed8; color: #fff; width: 100%; }
  button.primary:disabled { background: #9fb2e8; cursor: not-allowed; }
  button.secondary { background: #eef0f3; color: #1f2430; font-size: 13px; padding: 7px 12px; font-weight: 500; }
  .docs-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .doc-row { display: flex; align-items: center; justify-content: space-between; background: #f7f8fa; border-radius: 7px; padding: 8px 10px; font-size: 13px; }
  .doc-row .cat { color: #5b6472; text-transform: capitalize; }
  .upload-row { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  .upload-row select { flex: 0 0 auto; width: auto; }
  .hidden { display: none !important; }
  .readonly-banner { font-size: 13px; }
</style>
</head>
<body>
<div class="wrap" id="app">
  <header>
    <h1 id="pageTitle">Onboarding</h1>
    <p id="pageSubtitle">Loading…</p>
  </header>
  <div id="msgArea"></div>
  <div id="formArea" class="hidden"></div>
</div>

<script>
(function () {
  var token = window.location.pathname.split('/').filter(Boolean).pop();
  var apiBase = window.location.pathname.replace(/\\/$/, '');
  var msgArea = document.getElementById('msgArea');
  var formArea = document.getElementById('formArea');
  var pageSubtitle = document.getElementById('pageSubtitle');
  var currentData = null;

  var DOC_CATEGORIES = [
    ['photo', 'Photo'], ['aadhaar', 'Aadhaar'], ['pan', 'PAN'],
    ['education_certificate', 'Education Certificate'],
    ['experience_certificate', 'Experience Certificate'],
    ['relieving_letter', 'Relieving Letter'], ['payslip', 'Payslip'],
    ['employment_proof', 'Employment Proof'], ['other', 'Other'],
  ];

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function showMessage(text, kind) {
    msgArea.innerHTML = '';
    msgArea.appendChild(el('div', { class: 'msg ' + kind, text: text }));
  }

  function field(label, inputAttrs, value) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', { text: label }));
    var input = el(inputAttrs.tag === 'textarea' ? 'textarea' : 'input', {
      type: inputAttrs.type || 'text',
      'data-key': inputAttrs.key,
      placeholder: inputAttrs.placeholder || '',
    });
    if (value) input.value = value;
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function section(title, fieldDefs, values, refs) {
    var card = el('div', { class: 'card' });
    card.appendChild(el('h2', { text: title }));
    var row = el('div', { class: 'row2' });
    fieldDefs.forEach(function (fd, i) {
      var f = field(fd.label, fd, values ? values[fd.key] : '');
      refs[fd.key] = f.input;
      row.appendChild(f.wrap);
    });
    card.appendChild(row);
    return card;
  }

  function collect(refs) {
    var out = {};
    Object.keys(refs).forEach(function (k) { out[k] = refs[k].value; });
    return out;
  }

  function renderForm(data) {
    currentData = data;
    var record = data.record;
    var response = data.response || {};
    document.getElementById('pageTitle').textContent = record.tempName + "'s Onboarding";
    pageSubtitle.textContent = 'Reference ' + record.onboardingRef + ' · ' + (record.employeeType === 'experienced' ? 'Experienced Hire' : 'Fresher');

    if (!data.editable) {
      showMessage(
        data.status === 'submitted' || data.status === 'hr_review'
          ? 'Thanks — your submission is with HR for review. You will be emailed if any changes are needed.'
          : data.status === 'changes_requested'
          ? 'Changes were requested — please scroll down and resubmit.'
          : 'This onboarding step has already been completed.',
        data.status === 'changes_requested' ? 'info' : 'success',
      );
      if (data.status !== 'changes_requested') { formArea.classList.add('hidden'); return; }
    }

    formArea.innerHTML = '';
    formArea.classList.remove('hidden');
    var refs = { personalDetails: {}, contactInfo: {}, emergencyContact: {}, education: {}, bankDetails: {}, employmentHistory: {} };

    formArea.appendChild(section('Personal Details', [
      { key: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)' },
      { key: 'gender', label: 'Gender' },
      { key: 'maritalStatus', label: 'Marital Status' },
    ], response.personalDetails, refs.personalDetails));

    formArea.appendChild(section('Contact Information', [
      { key: 'personalEmail', label: 'Personal Email', type: 'email' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'currentAddress', label: 'Current Address', tag: 'textarea' },
      { key: 'permanentAddress', label: 'Permanent Address', tag: 'textarea' },
    ], Object.assign({ personalEmail: record.email, mobile: '' }, response.contactInfo), refs.contactInfo));

    formArea.appendChild(section('Emergency Contact', [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'relation', label: 'Relation' },
    ], response.emergencyContact, refs.emergencyContact));

    formArea.appendChild(section('Education', [
      { key: 'tenthInstitution', label: '10th — Institution' },
      { key: 'tenthYearPercent', label: '10th — Year / %' },
      { key: 'twelfthInstitution', label: '12th — Institution' },
      { key: 'twelfthYearPercent', label: '12th — Year / %' },
      { key: 'ugInstitution', label: 'UG — Institution' },
      { key: 'ugYearPercent', label: 'UG — Year / CGPA' },
      { key: 'pgInstitution', label: 'PG — Institution (if any)' },
      { key: 'pgYearPercent', label: 'PG — Year / CGPA' },
    ], response.education, refs.education));

    formArea.appendChild(section('Bank / Payroll Details', [
      { key: 'accountHolderName', label: 'Account Holder Name' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'ifsc', label: 'IFSC Code' },
    ], response.bankDetails, refs.bankDetails));

    if (record.employeeType === 'experienced') {
      formArea.appendChild(section('Employment History', [
        { key: 'previousCompany', label: 'Previous Company' },
        { key: 'previousDesignation', label: 'Previous Designation' },
        { key: 'totalExperience', label: 'Total Experience' },
        { key: 'relevantExperience', label: 'Relevant Experience' },
        { key: 'previousEmployeeId', label: 'Previous Employee ID' },
        { key: 'previousJoiningDate', label: 'Previous Joining Date' },
        { key: 'previousRelievingDate', label: 'Previous Relieving Date' },
        { key: 'previousCTC', label: 'Previous CTC' },
        { key: 'currentCTC', label: 'Current CTC' },
        { key: 'noticePeriod', label: 'Notice Period' },
        { key: 'previousManagerName', label: "Previous Manager's Name" },
        { key: 'previousManagerContact', label: "Previous Manager's Contact" },
      ], response.employmentHistory, refs.employmentHistory));
    }

    // Documents
    var docCard = el('div', { class: 'card' });
    docCard.appendChild(el('h2', { text: 'Documents' }));
    var list = el('div', { class: 'docs-list', id: 'docsList' });
    (response.documents || []).forEach(function (d) { list.appendChild(docRow(d)); });
    docCard.appendChild(list);

    var catSelect = el('select', { id: 'docCategory' });
    DOC_CATEGORIES.forEach(function (c) {
      var opt = el('option', { value: c[0], text: c[1] });
      catSelect.appendChild(opt);
    });
    var fileInput = el('input', { type: 'file', id: 'docFile' });
    var uploadBtn = el('button', { class: 'secondary', type: 'button', text: 'Upload' });
    uploadBtn.addEventListener('click', function () { uploadDocument(catSelect.value, fileInput); });
    var uploadRow = el('div', { class: 'upload-row' }, [catSelect, fileInput, uploadBtn]);
    docCard.appendChild(uploadRow);
    formArea.appendChild(docCard);

    var submitBtn = el('button', { class: 'primary', type: 'button', text: data.status === 'changes_requested' ? 'Resubmit' : 'Submit' });
    submitBtn.addEventListener('click', function () { submitForm(refs, submitBtn); });
    formArea.appendChild(el('div', { class: 'actions' }, [submitBtn]));
  }

  function docRow(d) {
    return el('div', { class: 'doc-row' }, [
      el('span', { text: d.name }),
      el('span', { class: 'cat', text: d.category.replace(/_/g, ' ') }),
    ]);
  }

  function submitForm(refs, btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    var contact = collect(refs.contactInfo);
    var payload = {
      personalDetails: collect(refs.personalDetails),
      contactInfo: contact,
      emergencyContact: collect(refs.emergencyContact),
      education: collect(refs.education),
      bankDetails: collect(refs.bankDetails),
    };
    if (currentData.record.employeeType === 'experienced') {
      payload.employmentHistory = collect(refs.employmentHistory);
    }
    fetch(apiBase + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.body && r.body.message) || 'Submit failed');
        showMessage('Thank you — your onboarding information has been submitted to HR for review.', 'success');
        renderForm(r.body);
      })
      .catch(function (err) {
        showMessage(err.message || 'Something went wrong. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Submit';
      });
  }

  function uploadDocument(category, fileInput) {
    var file = fileInput.files && fileInput.files[0];
    if (!file) { showMessage('Choose a file first.', 'error'); return; }
    var fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    fetch(apiBase + '/documents', { method: 'POST', body: fd })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.body && r.body.message) || 'Upload failed');
        var list = document.getElementById('docsList');
        list.innerHTML = '';
        r.body.forEach(function (d) { list.appendChild(docRow(d)); });
        fileInput.value = '';
      })
      .catch(function (err) { showMessage(err.message || 'Upload failed.', 'error'); });
  }

  function init() {
    if (!token) { showMessage('This onboarding link is invalid.', 'error'); pageSubtitle.textContent = ''; return; }
    fetch(apiBase + '/data')
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error((r.body && r.body.message) || 'This onboarding link is invalid or has expired.');
        pageSubtitle.textContent = '';
        renderForm(r.body);
      })
      .catch(function (err) {
        pageSubtitle.textContent = '';
        showMessage(err.message, 'error');
      });
  }

  init();
})();
</script>
</body>
</html>`;
}
