import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SPLASH_HTML } from './splashHtml';

const BG = '#F4FAEE'; // matches the splash background so there is no white flash

// Hides the web "Replay" button inside the app
const HIDE_REPLAY = "document.getElementById('b').style.display='none';true;";

export default function AnimatedSplash({ onFinish, minDuration = 6500, onReady }) {
  useEffect(() => {
    const t = setTimeout(onFinish, minDuration);
    return () => clearTimeout(t);
  }, [onFinish, minDuration]);

  return (
    <View style={styles.fill} onLayout={onReady}>
      <WebView
        originWhitelist={['*']}
        source={{ html: SPLASH_HTML }}
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        injectedJavaScript={HIDE_REPLAY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: BG, zIndex: 999 },
  web: { flex: 1, backgroundColor: BG },
});
