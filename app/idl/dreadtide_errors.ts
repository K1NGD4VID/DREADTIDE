
export const DreadtideErrorCode = {
  WrongPhase: 6000,
  DeadlinePassed: 6001,
  DeadlineNotPassed: 6002,
  NotPlayer: 6003,
  WrongPlayer: 6004,
  SelfJoin: 6005,
  AlreadyCommitted: 6006,
  InvalidCell: 6007,
  DuplicateShot: 6008,
  InvalidProof: 6009,
  NoEligibleClaimant: 6010,
  ClockOverflow: 6011,
  ArithmeticOverflow: 6012,
  DailyAlreadyClaimed: 6013,
  StakeBelowMinimum: 6014,
  InsufficientDCoins: 6015,
  StakeAlreadyDeposited: 6016,
  StakeNotReady: 6017,
  StakeAlreadySettled: 6018,
  MatchNotFinished: 6019,
  NoOpponent: 6020,
  InvalidSessionExpiry: 6021,
  InvalidSessionDelegate: 6022,
  SessionExpired: 6023,
  LegacyInstructionDisabled: 6024,
  TimedMatchRequired: 6025,
  InsufficientResponseWindow: 6026,
  ResponseDeadlinePassed: 6027
};

export type DreadtideErrorName = keyof typeof DreadtideErrorCode;
