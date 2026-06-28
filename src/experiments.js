export const EXPERIMENTS = [
  { id: 'Violeta', label: 'Poción Violeta', emoji: '🪻', hex: 0xa855f7, cssClass: 'violeta', recipe: ['Rojo', 'Azul'] },
  { id: 'Verde', label: 'Poción Verde', emoji: '🍃', hex: 0x10b981, cssClass: 'verde', recipe: ['Azul', 'Amarillo'] },
  { id: 'Anaranjado', label: 'Poción Naranja', emoji: '🍊', hex: 0xf97316, cssClass: 'naranja', recipe: ['Rojo', 'Amarillo'] },
];

export const EXPERIMENT_STATUS = {
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
};

export const INITIAL_EXPERIMENT_STATUS = Object.fromEntries(
  EXPERIMENTS.map((exp) => [exp.id, EXPERIMENT_STATUS.PENDING])
);

export function isExperimentLocked(status) {
  return status !== EXPERIMENT_STATUS.PENDING;
}

export function getNextPendingExperiment(experimentStatus) {
  return EXPERIMENTS.find((exp) => experimentStatus[exp.id] === EXPERIMENT_STATUS.PENDING);
}

export function allExperimentsAttempted(experimentStatus) {
  return EXPERIMENTS.every((exp) => experimentStatus[exp.id] !== EXPERIMENT_STATUS.PENDING);
}

export function countPassed(experimentStatus) {
  return EXPERIMENTS.filter((exp) => experimentStatus[exp.id] === EXPERIMENT_STATUS.PASSED).length;
}

export function countPending(experimentStatus) {
  return EXPERIMENTS.filter((exp) => experimentStatus[exp.id] === EXPERIMENT_STATUS.PENDING).length;
}

export function allExperimentsPassed(experimentStatus) {
  return EXPERIMENTS.every((exp) => experimentStatus[exp.id] === EXPERIMENT_STATUS.PASSED);
}
