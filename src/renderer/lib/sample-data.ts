// Bundled sample profile so the app can be tried before uploading anything
// real — a first-run affordance (classroom demos, curious downloads). The
// data is deliberately fictional and generic.

import { useSessionStore } from '@/lib/session-store';

export const SAMPLE_FILENAME = 'sample-resume.md';

export const SAMPLE_RESUME = `Jordan Lee
Perth, WA · jordan.lee@example.com

EDUCATION
Bachelor of Science (Data Science), Curtin University — final year
Relevant units: statistics, machine learning fundamentals, databases, data visualisation

EXPERIENCE
Retail Team Member, Coles (2023–present)
- Rostered shifts while studying full time; trusted with end-of-day reconciliation
- Built a spreadsheet that cut weekly stock-count time for the team

Volunteer Data Helper, local sports club (2024)
- Cleaned five seasons of match statistics in Excel and Google Sheets
- Produced simple charts the committee used to plan junior programs

PROJECTS
Unit project: predicted Perth rental prices with Python (pandas, scikit-learn)
Personal: small dashboard of personal spending built with Python and Streamlit

SKILLS
Python (pandas, matplotlib), SQL basics, Excel, Git, report writing
`;

export const SAMPLE_ABOUT =
  'Final-year data science student in Perth. I like making messy data understandable ' +
  'and I am trying to work out whether to aim for data analyst roles, something more ' +
  'engineering-flavoured, or further study.';

export const SAMPLE_JOB_TITLE = 'Graduate data analyst';

// Loads the sample profile into the session (resume, about-you, and a target
// role so every activity is immediately runnable).
export function loadSampleProfile(): void {
  const store = useSessionStore.getState();
  store.setResume(SAMPLE_RESUME, SAMPLE_FILENAME);
  store.setFreeText(SAMPLE_ABOUT);
  store.setJobTitle(SAMPLE_JOB_TITLE);
}
