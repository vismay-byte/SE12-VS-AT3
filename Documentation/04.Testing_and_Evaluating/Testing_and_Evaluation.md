# Starting Point:

## Test Plan and Report

[Test Report](/Documentation/04.Testing_and_Evaluating/Test_Report_Documents/01.02.Test_Report.md)
[Test Cases](/Documentation/04.Testing_and_Evaluating/Test_Report_Documents/03.Test%20Cases.md)
[Evidence of Testing](/Documentation/04.Testing_and_Evaluating/Test_Report_Documents/04.Evidence_of_Testing.md)
[Bud Tracking and Fixes](/Documentation/04.Testing_and_Evaluating/Test_Report_Documents/05.Bug_Tracking_and_Fixing.md)

___

## Summary of Feedback

### Client Feedback

Throughout the project, wireframes and working pages were sent to my client over Instagram and email for feedback before and after each feature was built, as set out in the communication plan in Research and Planning. Reviewing the finished app from the client's perspective, and specifically looking for functionality and usability in the cockpit, the main points raised were as follows.

On functionality, the client was positive about the Wind Triangle, Time and ETA, and Fuel and Reserve calculations once the Self-test panels were shown working, since seeing a hand-checkable expected value next to the actual output built confidence that the maths matched real navigation procedure rather than being a black box. The client also liked that the Go/No-Go page pulls live indicative weather from Open-Meteo without needing an account or an API key, since this matches how a student pilot would want to check conditions quickly before a lesson. However, the client pointed out that the Route Planner's own Wind Preview panel still only accepted manually entered wind figures rather than pulling the same live weather the Go/No-Go page already used, which felt inconsistent since both panels answer a similar question about the wind on the day.

On usability in the cockpit specifically, the client's main note was that the app needed to work "at a glance" rather than requiring the pilot to read closely, given a cockpit is a high workload, distracting environment. They liked the light/dark theme switch for daylight ground use versus low light cockpit use, and the checklist dropdowns keeping most of a checklist phase visible without needing to tick off every item individually mid-flight. The client also asked for a printable PDF export of the NAVLOG for students who would rather glance at a paper copy clipped to a kneeboard than look at a screen while flying, since not every student pilot wants a tablet in the cockpit. Separately, while testing the Logbook feature the client found that the "log in to view your logbook" prompt could appear even when already logged in, and that clicking it actually logged them out rather than opening a login dialog, which they flagged as confusing and worth fixing before relying on the app to keep a real logbook.

### How This Was Responded To

In response to the client's functionality feedback, the Wind Preview panel's "Fetch indicative weather" control was added to call the same Open-Meteo fetch already used by the Go/No-Go page, so both panels now use one consistent live weather source instead of the Route Planner relying on manual entry alone. The Logbook login issue the client found was traced to the logged-out prompt's button forwarding its click to the account button, which signs a user out if it believes one is already logged in, and is tracked as BUG-03 in 05.Bug_Tracking_and_Fixing.md pending a fix that gives the prompt its own click handler that opens the login dialog directly.

In response to the client's usability feedback, the PDF export (via jsPDF, lazy loaded only when needed) was added specifically so a student who would rather use a paper kneeboard copy is not forced to look at a screen in flight, and the light/dark theme switch and checklist dropdowns were kept and refined through the wireframe review cycle described in the Usability QA Checklist.

In response to my teacher's feedback, the Research and Planning document's Software Development Approach section was rewritten to justify Agile around adjusting timeline and incorporating client feedback more frequently, rather than a generic ease-of-use justification. The five Software Evaluation documents in 04.Testing_and_Evaluating/Software_Evaluation_Template were also restructured so every QA Checklist criterion sits in its own Criteria, Has the Criteria Been Achieved, and Analysis table, matching the structure my teacher recommended.


3. Software Evaluation relating to the functional and performance requirements that you specified in your Quality Assurance Checklist in Section 2 of your report.

[Functionality Evaluation](/Documentation/04.Testing_and_Evaluating/Software_Evaluation_Template/01.Functionality_Evaluation.md)
[Usability Evaluation](/Documentation/04.Testing_and_Evaluating/Software_Evaluation_Template/02.Usability_Evaluation.md)
[Performance Evaluation](/Documentation/04.Testing_and_Evaluating/Software_Evaluation_Template/03.Performance_Evaluation.md)
[Security Evaluation](/Documentation/04.Testing_and_Evaluating/Software_Evaluation_Template/04.Security_Evaluation.md)
[Testing Evaluation](/Documentation/04.Testing_and_Evaluating/Software_Evaluation_Template/07.Testing_Evaluation.md)

---



##### [Back to Master](/at-3-e-portfolio-vismay-swami-attempt-3/Master_ePortfolio.md)

---

##### Vismay Swami Software Engineering AT3

**Email** · vismay.swami@education.nsw.gov.au