import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext({
  isConnected: true,
  connectionType: 'wifi',
  isOnMobileData: false,
  networkChangeKey: 0,
});

export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState('wifi');
  const [networkChangeKey, setNetworkChangeKey] = useState(0);
  const prevTypeRef = useRef('wifi');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      const type = state.type; // 'wifi' | 'cellular' | 'none' | 'unknown'

      setIsConnected(!!connected);
      setConnectionType(type);

      // Bump the key whenever the interface actually switches so
      // socket useEffects can reconnect immediately instead of timing out.
      if (type !== prevTypeRef.current) {
        prevTypeRef.current = type;
        setNetworkChangeKey((k) => k + 1);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        connectionType,
        isOnMobileData: connectionType === 'cellular',
        networkChangeKey,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
