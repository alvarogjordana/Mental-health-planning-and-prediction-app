/** Mock insight text shown on the Vertical Detail page, one entry per vertical. */
export const VERTICAL_INSIGHTS: Record<string, string[]> = {
  HEALTH: [
    "You averaged 7,200 steps/day this week — close to your baseline but short of the 8,000-step target.",
    "Active minutes were below your usual baseline on 3 of the last 7 days.",
    "Your resting heart rate trended slightly higher mid-week, often a sign of accumulated fatigue.",
    "Workout sessions logged: 2 out of a target of 4 this week.",
  ],
  WORK_LIFE: [
    "You had 6+ meetings on 4 out of 5 working days, leaving little room for deep work.",
    "Only 2 free focus blocks of 30+ minutes appeared in your calendar this week.",
    "Meeting minutes peaked on Wednesday at 3h 20m — your highest single day this month.",
    "Screen time averaged 6.4 hours/day, up 18% from your usual baseline.",
  ],
  SOCIAL: [
    "No social events were logged in the last 4 days — the longest gap in 3 weeks.",
    "Your check-ins cited 'feeling disconnected' as a mood driver twice this week.",
    "Social media usage was up 22% while in-person connection time was down.",
    "You had 3 meaningful conversations logged — your typical week averages 5.",
  ],
  PURPOSE: [
    "3 check-ins this week cited 'sense of progress' as a primary mood driver.",
    "You completed 2 of 3 personal goals set at the start of the week.",
    "Reflection notes show a recurring theme of wanting more creative work time.",
    "Purpose score has dipped gradually over 5 days — often correlated with routine overload.",
  ],
  SLEEP: [
    "Average sleep was 6.4 hours — below the 7.5-hour threshold linked to mood stability.",
    "Phone screen time after 10pm averaged 38 minutes, directly overlapping with sleep onset.",
    "You logged 2 nights under 6 hours, which correlates with your lower-energy check-ins.",
    "Sleep consistency was low — bedtime varied by over 90 minutes across the week.",
  ],
};
