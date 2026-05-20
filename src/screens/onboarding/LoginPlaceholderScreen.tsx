// LoginPlaceholderScreen — stub for KAN-26.
// Routes here from Splash "Sign In" button until KAN-26 ships.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Login'>;

export default function LoginPlaceholderScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sign in is coming soon.</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  text: { color: '#fff', fontSize: 16, marginBottom: 24 },
  back: { color: '#71bdfe', fontSize: 14 },
});
