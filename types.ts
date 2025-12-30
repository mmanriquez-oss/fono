
export interface PronunciationError {
  part: string;
  issue: string;
  suggestion: string;
}

export interface AnalysisResult {
  score: number;
  feedback: string;
  errors: PronunciationError[];
  improvementTips: string[];
  transcription: string;
}

export enum AppStatus {
  SETUP = 'SETUP',
  GAME_IDLE = 'GAME_IDLE',
  GAME_RECORDING = 'GAME_RECORDING',
  GAME_ANALYZING = 'GAME_ANALYZING',
  GAME_RESULTS = 'GAME_RESULTS',
  GAME_GENERATING_REPORT = 'GAME_GENERATING_REPORT',
  GAME_OVER = 'GAME_OVER',
  ERROR = 'ERROR'
}

export interface WordInfo {
  text: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

export interface WordResult {
  word: WordInfo;
  analysis: AnalysisResult;
}

export interface AppState {
  wordList: WordInfo[];
  currentIndex: number;
  totalScore: number;
  status: AppStatus;
  analysis: AnalysisResult | null;
  error: string | null;
  history: WordResult[];
  phonologicalReport?: string;
}
