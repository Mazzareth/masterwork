'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';


interface IOSPointerContextType {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const IOSPointerContext = createContext<IOSPointerContextType | undefined>(undefined);

interface IOSPointerProviderProps {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}

export function IOSPointerProvider({
  children,
  defaultEnabled = true,
}: IOSPointerProviderProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Only enable on desktop devices with fine pointer (mouse)
    const isDesktop = window.matchMedia('(min-width: 768px) and (pointer: fine)').matches;
    setIsEnabled(defaultEnabled && isDesktop);
  }, [defaultEnabled]);

  const contextValue: IOSPointerContextType = {
    isEnabled,
    setIsEnabled,
  };

  return (
    <IOSPointerContext.Provider value={contextValue}>
      {children}
    </IOSPointerContext.Provider>
  );
}

export function useIOSPointer() {
  const context = useContext(IOSPointerContext);
  if (context === undefined) {
    throw new Error('useIOSPointer must be used within an IOSPointerProvider');
  }
  return context;
}