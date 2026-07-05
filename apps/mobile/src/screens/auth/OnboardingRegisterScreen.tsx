import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { setSession } from '../../store/slices/authSlice';
import { onboardingApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';

export default function OnboardingRegisterScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', dateOfBirth: '', address: '',
    emergencyContactName: '', emergencyContactPhone: '', password: '', confirm: '',
  });
  const [prefill, setPrefill] = useState<{ designation?: string; department?: string; tempEmployeeId?: string }>({});
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const verify = async () => {
    if (!email.trim() || code.trim().length < 4) return Alert.alert('Missing', 'Enter your invite email and code.');
    setBusy(true);
    try {
      const { data } = await onboardingApi.verify(email.trim(), code.trim());
      setForm((f) => ({ ...f, firstName: data.firstName || '', lastName: data.lastName || '' }));
      setPrefill({ designation: data.designation, department: data.department, tempEmployeeId: data.tempEmployeeId });
      setStep(2);
    } catch (e: any) {
      Alert.alert('Invalid invite', getErrorMessage(e, 'Check your email and code.'));
    } finally { setBusy(false); }
  };

  const complete = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return Alert.alert('Name required', 'Enter your first and last name.');
    if (form.password.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (form.password !== form.confirm) return Alert.alert('Mismatch', 'Passwords do not match.');
    setBusy(true);
    try {
      const { data } = await onboardingApi.complete({
        personalEmail: email.trim(), code: code.trim(), password: form.password,
        firstName: form.firstName, lastName: form.lastName, phone: form.phone,
        dateOfBirth: form.dateOfBirth || undefined, address: form.address,
        emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
      });
      // Auto-login the newly provisioned account
      await AsyncStorage.setItem('access_token', data.access_token);
      await AsyncStorage.setItem('auth_cache', JSON.stringify({ user: data.user, employee: data.employee }));
      Alert.alert('Welcome aboard! 🎉', `Your company account is ready.\n\nEmail: ${data.provisionedEmail}\nEmployee ID: ${data.employee?.employeeId}`, [
        { text: 'Get started', onPress: () => dispatch(setSession({ access_token: data.access_token, user: data.user, employee: data.employee })) },
      ]);
    } catch (e: any) {
      Alert.alert('Could not complete', getErrorMessage(e, 'Please try again.'));
    } finally { setBusy(false); }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.title}>{step === 1 ? 'Employee onboarding' : 'Complete your profile'}</Text>
          <Text style={s.subtitle}>
            {step === 1 ? 'Enter the email and code from your invitation.' : `Welcome${form.firstName ? ', ' + form.firstName : ''}! Fill in your details to activate your account.`}
          </Text>

          {step === 1 ? (
            <>
              <TextInput style={s.input} placeholder="Invitation email" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <TextInput style={s.input} placeholder="Invite code" placeholderTextColor="#9CA3AF" keyboardType="number-pad" value={code} onChangeText={setCode} />
              <TouchableOpacity style={s.btn} onPress={verify} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>Verify invitation</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!!(prefill.designation || prefill.department) && (
                <View style={s.roleTag}><Text style={s.roleTagTx}>{prefill.designation} · {prefill.department}</Text></View>
              )}
              <View style={s.rowTwo}>
                <TextInput style={[s.input, s.half]} placeholder="First name" placeholderTextColor="#9CA3AF" value={form.firstName} onChangeText={(v) => set('firstName', v)} />
                <TextInput style={[s.input, s.half]} placeholder="Last name" placeholderTextColor="#9CA3AF" value={form.lastName} onChangeText={(v) => set('lastName', v)} />
              </View>
              <TextInput style={s.input} placeholder="Phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set('phone', v)} />
              <TextInput style={s.input} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor="#9CA3AF" value={form.dateOfBirth} onChangeText={(v) => set('dateOfBirth', v)} />
              <TextInput style={s.input} placeholder="Address" placeholderTextColor="#9CA3AF" value={form.address} onChangeText={(v) => set('address', v)} />
              <View style={s.rowTwo}>
                <TextInput style={[s.input, s.half]} placeholder="Emergency name" placeholderTextColor="#9CA3AF" value={form.emergencyContactName} onChangeText={(v) => set('emergencyContactName', v)} />
                <TextInput style={[s.input, s.half]} placeholder="Emergency phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={form.emergencyContactPhone} onChangeText={(v) => set('emergencyContactPhone', v)} />
              </View>
              <TextInput style={s.input} placeholder="Create password (min 8)" placeholderTextColor="#9CA3AF" secureTextEntry value={form.password} onChangeText={(v) => set('password', v)} />
              <TextInput style={s.input} placeholder="Confirm password" placeholderTextColor="#9CA3AF" secureTextEntry value={form.confirm} onChangeText={(v) => set('confirm', v)} />
              <TouchableOpacity style={s.btn} onPress={complete} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>Complete onboarding</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={[s.link, { marginTop: 18 }]}>← Back to sign in</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a56db', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 13, marginBottom: 12, fontSize: 15, color: '#111827' },
  rowTwo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  btn: { backgroundColor: '#1a56db', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 2 },
  btnTx: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: '#4F46E5', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  roleTag: { alignSelf: 'center', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  roleTagTx: { color: '#4F46E5', fontWeight: '700', fontSize: 12 },
});
