import React, {createContext, ReactNode, useContext} from 'react';
import {
  DefaultAuthConfig,
  DefaultTransactionConfig,
  DefaultMockDataConfig,
  AuthProviderConfig,
  TransactionProviderConfig,
  MockDataConfig,
  DefaultCustomizationConfig,
  CustomizationConfig,
} from '.';

const defaultCustomization: CustomizationConfig = DefaultCustomizationConfig;

const CustomizationContext =
  createContext<CustomizationConfig>(defaultCustomization);

export const CustomizationProvider = ({
  children,
  config,
}: {
  children: ReactNode;
  config?: Partial<CustomizationConfig>;
}) => {
  const mergedConfig: CustomizationConfig = {
    auth: {
      ...defaultCustomization.auth,
      ...(config?.auth || {}),
    },
    transaction: {
      ...defaultCustomization.transaction,
      ...(config?.transaction || {}),
    },
    mockData: {
      ...defaultCustomization.mockData,
      ...(config?.mockData || {}),
    },
  };

  return (
    <CustomizationContext.Provider value={mergedConfig}>
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => useContext(CustomizationContext);
