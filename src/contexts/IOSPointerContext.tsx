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

/**
 * @description Provides the IOSPointerContext to its children.
 * @param {IOSPointerProviderProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered component.
 */
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

/**
 * @description A hook to access the IOSPointerContext.
 * @returns {IOSPointerContextType} The IOS pointer context.
 * @throws Will throw an error if used outside of an IOSPointerProvider.
 */
export function useIOSPointer() {
  const context = useContext(IOSPointerContext);
  if (context === undefined) {
    throw new Error('useIOSPointer must be used within an IOSPointerProvider');
  }
  return context;
}