// Shared TypeScript types for the Freedom app

export enum WellbeingVertical {
  HEALTH = "HEALTH",
  WORK_LIFE = "WORK_LIFE",
  SOCIAL = "SOCIAL",
  PURPOSE = "PURPOSE",
  SLEEP = "SLEEP",
}

export type VerticalWeight = Record<WellbeingVertical, number>;
// Each value should be 0–1, and all values must sum to 1.

export interface UserProfile {
  id: string;
  name: string;
  personalityNotes?: string;
  priorities?: string[];
  energizers?: string[];
  drainers?: string[];
  verticalWeights?: VerticalWeight;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface WeeklySuggestion {
  category: "stop" | "start" | "continue";
  action: string;
  reasoning: string;
}
