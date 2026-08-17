import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator } from 'react-native';
import { T } from '../../data/hrData';
import { onboardNotifyApi, employeeApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';

type EmployeeType = 'fresher' | 'experienced';

interface ManagerOption {
  id: string; // employees.id — what CreateOnboardingRecordDto.reportingManagerId expects
  name: string;
  designation?: string;
}

export default function OnboardNotifyCreateScreen({ navigation }: any) {
  const [tempName, setTempName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [employeeType, setEmployeeType] = useState<EmployeeType>('fresher');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reporting manager — a lightweight inline search over the employee
  // directory rather than a dedicated picker screen, since this is the only
  // field on this form that needs one.
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [managerQuery, setManagerQuery] = useState('');
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerOption | null>(null);

  useEffect(() => {
    employeeApi
      .getAll()
      .then(({ data }) => {
        const list: ManagerOption[] = (data ?? []).map((e: any) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          designation: e.designation,
        }));
        setManagers(list);
      })
      .catch(() => {});
  }, []);

  const filteredManagers = useMemo(() => {
    const q = managerQuery.trim().toLowerCase();
    if (!q) return managers.slice(0, 20);
    return managers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 20);
  }, [managers, managerQuery]);

  const canSubmit = tempName.trim() && mobile.trim() && email.trim() && !submitting;

  const onSubmit = async () => {
    if (!tempName.trim()) return Alert.alert('Name required', "Enter the candidate's name.");
    if (!mobile.trim()) return Alert.alert('Mobile required', "Enter the candidate's mobile number.");
    if (!email.trim()) return Alert.alert('Email required', "Enter the candidate's personal email.");

    setSubmitting(true);
    try {
      await onboardNotifyApi.create({
        tempName: tempName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        employeeType,
        expectedJoiningDate: expectedJoiningDate.trim() || undefined,
        department: department.trim() || undefined,
        designation: designation.trim() || undefined,
        reportingManagerId: selectedManager?.id,
      });
      Alert.alert(
        'Invitation sent',
        `${tempName.trim()} will receive a Login ID and temporary password at ${email.trim()} to sign in to the onboarding portal.`,
        [{ text: 'Done', onPress: () => navigation?.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Could not start onboarding', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.header} />
      <View style={st.header}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={st.back}><Text style={st.backTx}>‹</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hTitle}>New Onboarding</Text>
            <Text style={st.hSub}>Collect a new hire's details before they join</Text>
          </View>
        </View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={st.card}>
          <Text style={st.label}>Employee Type</Text>
          <View style={st.typeRow}>
            {(['fresher', 'experienced'] as EmployeeType[]).map((t) => (
              <TouchableOpacity key={t} style={[st.typeChip, employeeType === t && st.typeChipActive]} onPress={() => setEmployeeType(t)}>
                <Text style={[st.typeChipTx, employeeType === t && st.typeChipTxActive]}>{t === 'fresher' ? 'Fresher' : 'Experienced'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>Temporary Name *</Text>
          <TextInput style={st.input} placeholder="Full name" placeholderTextColor="#9CA3AF" value={tempName} onChangeText={setTempName} />

          <Text style={st.label}>Mobile Number *</Text>
          <TextInput style={st.input} placeholder="10-digit mobile number" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />

          <Text style={st.label}>Personal Email *</Text>
          <Text style={st.hint}>A Login ID and temporary password for the onboarding portal are sent here — no HRMS account needed.</Text>
          <TextInput style={st.input} placeholder="name@example.com" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />

          <Text style={st.label}>Expected Joining Date</Text>
          <TextInput style={st.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={expectedJoiningDate} onChangeText={setExpectedJoiningDate} />

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Department</Text>
              <TextInput style={st.input} placeholder="e.g. Engineering" placeholderTextColor="#9CA3AF" value={department} onChangeText={setDepartment} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Designation</Text>
              <TextInput style={st.input} placeholder="e.g. SDE 1" placeholderTextColor="#9CA3AF" value={designation} onChangeText={setDesignation} />
            </View>
          </View>

          <Text style={st.label}>Reporting Manager</Text>
          {selectedManager ? (
            <View style={st.managerChip}>
              <Text style={st.managerChipTx}>{selectedManager.name}</Text>
              <TouchableOpacity onPress={() => setSelectedManager(null)}><Text style={st.managerChipX}>✕</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={st.input}
                placeholder="Search employees…"
                placeholderTextColor="#9CA3AF"
                value={managerQuery}
                onChangeText={setManagerQuery}
                onFocus={() => setManagerPickerOpen(true)}
              />
              {managerPickerOpen && (
                <View style={st.managerList}>
                  {filteredManagers.length === 0 ? (
                    <Text style={st.managerEmpty}>No matches</Text>
                  ) : (
                    filteredManagers.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={st.managerRow}
                        onPress={() => { setSelectedManager(m); setManagerPickerOpen(false); setManagerQuery(''); }}
                      >
                        <Text style={st.managerRowName}>{m.name}</Text>
                        {!!m.designation && <Text style={st.managerRowDesig}>{m.designation}</Text>}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={[st.submitBtn, !canSubmit && st.submitBtnDisabled]} onPress={onSubmit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={st.submitBtnTx}>Send Onboarding Invite</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.header, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backTx: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: -4 },
  hTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  body: { flex: 1 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '700', color: T.sub, marginBottom: 6, marginTop: 14 },
  hint: { fontSize: 11.5, color: T.faint, marginBottom: 8, lineHeight: 15 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 13, fontSize: 15, color: T.ink, backgroundColor: '#FAFAFA' },
  row2: { flexDirection: 'row', gap: 12 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  typeChipActive: { backgroundColor: T.primary },
  typeChipTx: { fontSize: 13.5, fontWeight: '700', color: T.sub },
  typeChipTxActive: { color: '#FFF' },

  managerChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12 },
  managerChipTx: { color: T.primary, fontWeight: '700', fontSize: 14 },
  managerChipX: { color: T.primary, fontWeight: '700', fontSize: 14 },
  managerList: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 6, maxHeight: 180, overflow: 'hidden' },
  managerRow: { paddingVertical: 10, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  managerRowName: { fontSize: 13.5, fontWeight: '600', color: T.ink },
  managerRowDesig: { fontSize: 11.5, color: T.faint, marginTop: 1 },
  managerEmpty: { padding: 13, fontSize: 12.5, color: T.faint },

  submitBtn: { backgroundColor: T.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnTx: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
