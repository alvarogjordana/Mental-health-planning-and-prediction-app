// Future integration: Apple Health via HealthKit (iOS/macOS) or a companion app
// that exports resting heart rate, active calories, steps, and workout minutes.
// Real API: Apple HealthKit (native) or a middleware like Terra API (terra-api.com).

export interface HealthData {
  date: string; // ISO date "YYYY-MM-DD"
  restingHeartRate: number; // bpm
  activeCalories: number;
  steps: number;
  workoutMinutes: number;
}

export async function getHealthData(days = 7): Promise<HealthData[]> {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    return {
      date: date.toISOString().split("T")[0],
      restingHeartRate: 58 + Math.round(Math.random() * 10),
      activeCalories: 250 + Math.round(Math.random() * 300),
      steps: 6000 + Math.round(Math.random() * 6000),
      workoutMinutes: Math.round(Math.random() * 60),
    };
  });
}
