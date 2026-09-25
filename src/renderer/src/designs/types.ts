import React from 'react';
import { useAppLogic } from '../hooks/useAppLogic';

export type AppLogicState = ReturnType<typeof useAppLogic>;

export interface DesignProps extends AppLogicState {}

export interface DesignModule {
  id: string;
  name: string;
  description?: string;
  windowSize?: { width: number; height: number };
  component: React.ComponentType<DesignProps>;
}
