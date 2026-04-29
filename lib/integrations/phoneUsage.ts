// Future integration: iOS Screen Time (via Apple Family Sharing API or Shortcuts export)
// or Android Digital Wellbeing (via ADB or a companion app).
// Real API: Apple Screen Time API is private; common workaround is manual CSV export
// or a companion iOS Shortcut that posts data to this app's API route.

export interface PhoneUsageDay {
  date: string; // ISO date "YYYY-MM-DD"
  totalScreenMinutes: number;
  pickups: number;
  socialMediaMinutes: number;
  productivityMinutes: number;
  entertainmentMinutes: number;
}

export async function getPhoneUsageData(days = 7): Promise<PhoneUsageDay[]> {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    const total = 90 + Math.round(Math.random() * 240);
    const social = Math.round(total * (0.1 + Math.random() * 0.3));
    const productivity = Math.round(total * (0.05 + Math.random() * 0.2));
    const entertainment = Math.round(total * (0.1 + Math.random() * 0.25));
    return {
      date: date.toISOString().split("T")[0],
      totalScreenMinutes: total,
      pickups: 30 + Math.round(Math.random() * 80),
      socialMediaMinutes: social,
      productivityMinutes: productivity,
      entertainmentMinutes: entertainment,
    };
  });
}
