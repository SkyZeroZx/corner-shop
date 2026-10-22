import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  makeStateKey,
  provideEnvironmentInitializer,
  TransferState,
} from '@angular/core';

/**
 * Demo plumbing, not app code. `SAFE=1` flips every boundary decision at once.
 * The server reads the env var and hands the value to the browser via TransferState.
 */
export type LabMode = 'unsafe' | 'safe';

const LAB_MODE_KEY = makeStateKey<LabMode>('lab-mode');

export const LAB_MODE = new InjectionToken<LabMode>('LAB_MODE', {
  factory: () => inject(TransferState).get(LAB_MODE_KEY, 'unsafe'),
});

export function provideServerLabMode(mode: LabMode): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: LAB_MODE, useValue: mode },
    provideEnvironmentInitializer(() => inject(TransferState).set(LAB_MODE_KEY, mode)),
  ]);
}
