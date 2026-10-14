import React, { useCallback, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplash from './src/components/AnimatedSplash';
// import your existing providers/navigation here

SplashScreen.preventAutoHideAsync(); // keep the native splash until our animated one is on screen

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const hideNative = useCallback(() => SplashScreen.hideAsync(), []);
  const finish = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {/* <AuthProvider><NavigationContainer>...</NavigationContainer></AuthProvider> */}
      {!splashDone && <AnimatedSplash onReady={hideNative} onFinish={finish} />}
    </>
  );
}
