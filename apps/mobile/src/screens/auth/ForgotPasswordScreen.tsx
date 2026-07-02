import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, StatusBar,
} from 'react-native';
import { authApi } from '../../services/api';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) return Alert.alert('Email required', 'Enter your account email.');
    setBusy(true);
    try {
      const { data } = await authApi.forgotPassword(email.trim());
      setStep(2);
      if (data?.devOtp) Alert.alert('Reset code sent', `Dev mode — your code is ${data.devOtp}`);
      else Alert.alert('Reset code sent', 'Check your email for the 6-digit code.');
    } catch {
      Alert.alert('Could not send', 'Please try again in a moment.');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (otp.trim().length < 4) return Alert.alert('Enter the code', 'Enter the code from your email.');
    if (pw.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    if (pw !== pw2) return Alert.alert('Mismatch', 'Passwords do not match.');
    setBusy(true);
    try {
      await authApi.resetPassword(email.trim(), otp.trim(), pw);
      Alert.alert('Password reset', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Reset failed', e?.response?.data?.message || 'Invalid or expired code.');
    } finally { setBusy(false); }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.title}>Reset password</Text>
          <Text style={s.subtitle}>
            {step === 1 ? 'Enter your email and we\'ll send a reset code.' : `Enter the code sent to ${email}.`}
          </Text>

          {step === 1 ? (
            <>
              <TextInput style={s.input} placeholder="Email" placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <TouchableOpacity style={s.btn} onPress={sendCode} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>Send reset code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput style={s.input} placeholder="6-digit code" placeholderTextColor="#9CA3AF" keyboardType="number-pad" value={otp} onChangeText={setOtp} />
              <TextInput style={s.input} placeholder="New password" placeholderTextColor="#9CA3AF" secureTextEntry value={pw} onChangeText={setPw} />
              <TextInput style={s.input} placeholder="Confirm new password" placeholderTextColor="#9CA3AF" secureTextEntry value={pw2} onChangeText={setPw2} />
              <TouchableOpacity style={s.btn} onPress={reset} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>Reset password</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(1)}><Text style={s.link}>Use a different email</Text></TouchableOpacity>
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
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a56db', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 22, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 16, color: '#111827' },
  btn: { backgroundColor: '#1a56db', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 2 },
  btnTx: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: '#4F46E5', fontWeight: '600', fontSize: 13, textAlign: 'center', marginTop: 12 },
});
