# Project Journal

<br>

## Journal Entry (enter entry number here) (Enter Date Here)

### Aims


### Progress


### Challenges and Solutions


### Reflection


### Aim for Next Week


___

## Journal Entry 1 08/04/2026

### Aims
Look through the SE12 notification and task sheet and clone the provided ePortfolio template. This matters because I need a working template folder before I can start putting any actual project content into it, and it is the first practical step listed for this stage of the project.

### Progress
Cloned the template repository and confirmed I could open and edit the markdown files locally without anything breaking. No project-specific content was written yet since this week was about getting the tooling and folder structure working, not starting research.

### Challenges and Solutions
The only friction was getting familiar with how the markdown files link to each other and how the folder structure maps onto the Master ePortfolio page. I diagnosed this by opening each file and tracing its links by hand, and worked it out by comparing the template against the Set task sheet (Course Notes) rather than needing outside help.

### Reflection
Went well since the setup itself was straightforward and nothing was broken by the end of the week. Nothing went wrong, mainly because there was not much to break yet, though in hindsight I should have skimmed ahead to later Set tasks so I understood how this week's setup would actually be used. No new technical skills yet, mostly just getting organised.

### Aim for Next Week
Begin editing the templates properly and start turning the blank structure into an actual project folder, ready to begin brainstorming a project idea.

___

## Journal Entry 2 22/04/2026

### Aims
Finish setting up the templates, begin editing the portfolio structure properly, and start brainstorming possible project ideas. This needs to happen before the Research and Planning document can start, since that document depends on already knowing what the project actually is.

### Progress
Completed the templates, including a first pass of testing that the links between files worked, and created the Master ePortfolio file that ties every section together. I also started a rough list of possible project ideas covering a few different interest areas.

### Challenges and Solutions
Linking the files correctly in VS Code caused a few broken-link errors. I diagnosed this by checking the file paths character by character against the actual folder names, since case and spacing both mattered, and fixed it by comparing my links against examples on Stack Overflow (Online Resources) of how relative markdown links should be written. Coming up with an idea was harder since the brief allows such a broad range of topics, which I dealt with by listing every hobby or area I actually know something about rather than trying to think of a "good project idea" in the abstract.

### Reflection
The linking errors were frustrating but a good early lesson in being precise with file paths, a skill that kept being useful for the rest of the project. Brainstorming without a clear direction did not go well, since I spent a lot of time on ideas I ended up not using. Next time I would narrow the brainstorm to a specific interest area much earlier instead of trying to consider everything at once.

### Aim for Next Week
Continue researching and narrow the brainstormed ideas down into one specific issue or opportunity to build a project around.

___

## Journal Entry 3 24/04/2026

### Aims
Narrow the brainstorm down and settle on the actual issue the project will address. Every later document (Research and Planning, the QA Checklist, and the build itself) depends on having one clear, specific project defined, so this decision needs to happen before anything else can properly start.

### Progress
Landed on a VFR navigation trainer for student pilots after realising it combined an interest of mine (aviation) with a genuine problem, being that student pilots have to juggle several separate paper-based tools (NAVLOG, checklists, wind calculations) that could reasonably be combined into one app.

### Challenges and Solutions
The main challenge was actually committing to one idea rather than continuing to compare options, since the brief allows such a broad range of project types. I worked through this by writing a short pros and cons note for my two strongest ideas (Course Notes on project selection helped structure this) and picking the one with a clearer real-world user (a student pilot) rather than a vaguer general audience.

### Reflection
Good to finally have a direction, since every other document has been waiting on this decision. What did not go well was how long the indecision dragged on. Next time I would set myself a hard deadline for narrowing down ideas rather than letting the brainstorm run open-ended.

### Aim for Next Week
Start researching the aviation topic in more depth and confirm a client, since I will need a real student pilot's perspective to check my assumptions about what the app should actually do. I also want to start looking into how METARs (aviation weather reports) are written and communicated, so I can decide the best way to let the app take that kind of information as an input.

___

## Journal Entry 4 01/05/2026

### Aims
Finalise the project idea and confirm a client, and begin broad research into the topic. This matters because the Research and Planning document needs a confirmed client before I can write a meaningful communication plan.

### Progress
Confirmed the VFR NAVLOG Trainer as the final project and found a client, a student pilot willing to give ongoing feedback throughout the build. I also completed a first pass of broad background research into VFR navigation procedures.

### Challenges and Solutions
Finding an appropriate client took longer than expected since I needed someone with genuine student pilot experience rather than just a general aviation enthusiast. I solved this by asking around through family and school contacts (Collaboration) rather than relying only on generic online forums. Understanding the varying procedures and protocols across different flight schools was also difficult, which I dealt with by cross-referencing a few different training organisations' materials (Online Resources) rather than trusting a single source.

### Reflection
Good progress overall now that both the idea and the client are locked in. What did not go so well was underestimating how long finding a suitable client would take. Next time I would start that search earlier, in parallel with the idea brainstorm rather than after it. My research skills improved this week, mainly around knowing when to stop reading broadly and start reading with a specific question in mind.

### Aim for Next Week
Work through the Research and Planning template, starting with the social and ethical issues section, since those issues need to be identified before I can properly justify later design and security decisions.

___

## Journal Entry 5 05/05/2026

### Aims
Complete the social and ethical issues section of the Research and Planning document and continue background research on the topic as a whole. This section needs to be settled early since it directly feeds into later decisions, for example the security section needs to already know that XSS and phishing were flagged as ethical risks up front.

### Progress
Completed the social and ethical issues section (see the Social and Ethical Issues heading in Research_and_Planning.md as evidence). On the ethical side, I focused on properly citing any code or inspiration I use, avoiding manipulative UI patterns, and making sure the app is designed to be secure enough against XSS and phishing given it will eventually store real, if only training, pilot data. On the social side, I wrote about the fact that not every major browser behaves identically so compatibility needs testing, and that not every aerodrome can realistically be covered given my time and hardware constraints, only the Sydney Basin. I also made further progress on general research, including starting to look at how different flight schools structure their own paper-based navigation logs.

### Challenges and Solutions
As with earlier weeks, there was a lot of information to process, and filtering out what was actually relevant to this specific project was difficult. I addressed this by focusing my reading specifically on materials aimed at student pilots rather than general aviation content (Online Resources), and by staying in contact with my client throughout (Collaboration) to check my understanding against a real student's experience.

### Reflection
I learned just how difficult researching for a large-scale project can be, especially with a topic that is not simple to understand without some aviation background. What went well was having my client available to sanity-check my research as I went. What I would do differently is set narrower research questions from the start instead of reading broadly and hoping relevance would become obvious on its own.

### Aim for Next Week
Move on to the Software Development Approach and Communication Plan sections of Research and Planning, and draft the Gantt chart, now that the ethical and social groundwork is settled.

___

## Journal Entry 6 12/05/2026

### Aims
Complete the Software Development Approach section (choosing and justifying Agile), draft the Gantt chart, and write up the communication plan for my client and teachers. This matters because Research and Planning is the document every later section, including the QA Checklist and Producing and Implementing, refers back to, so it needs to be finished before I can properly plan the QA Checklist criteria.

### Progress
Research_and_Planning.md is now mostly complete. I decided on Agile over Waterfall since the project has a lot of independent features (Route Planner, NAVLOG, Nav Page, Go/No-Go, Checklists, Logbook) that do not strictly depend on each other, which means I can build and get feedback in any order depending on how school work lines up in a given week. I also built the Gantt chart, evidence for which is saved as SE12-VS_GanttChart.png, and wrote out how I will stay in contact with my client (a student pilot) via Instagram and email, and my teacher via email. The main new concept I properly understood this week was the practical difference between Agile and Waterfall, rather than just their textbook definitions.

### Challenges and Solutions
Justifying Agile over other models was harder than expected because most of the course notes focus on Waterfall as the default model. I looked up a few comparisons of Agile against Waterfall online (Online Resources) and asked my teacher directly (Teacher Assistance), which helped me phrase the justification around flexibility and client feedback cycles rather than just picking Agile because it seemed easier. I chose to keep that framing since it reflects the actual reason the project suits Agile, rather than a generic benefit copied from a definition.

### Reflection
Went well since the plan feels realistic given my schedule. What did not go so well was the Gantt chart taking longer than expected. What I would do differently is start the Gantt chart earlier next time, since fitting every feature into a sensible order took longer than the actual writing. My understanding of software development models improved a lot this week, now that I have had to actually justify one rather than just describe it.

### Aim for Next Week
Start the data dictionary, listing every variable the app will use, now that the Research and Planning document's other sections are complete.

___

## Journal Entry 7 22/05/2026

### Aims
Draft the data dictionary that lists every variable the app will use, covering route, leg, wind, fuel, weather, and personal-minimums fields. This needs to happen before I can talk about specific variables in the QA Checklist or design the calculation functions with any precision.

### Progress
Completed the data dictionary, which ended up with over fifty variables once I actually listed out route, leg, wind-triangle, fuel, aerodrome, and weather fields individually rather than thinking about them in vague groups. The new concept I picked up this week was how much clearer calculation logic becomes once every input and output has a properly defined name, type, and format ahead of time, instead of naming things as I go while coding.

### Challenges and Solutions
The data dictionary was more time-consuming than expected because a lot of the aviation variables (true course versus heading versus bearing, groundspeed versus true airspeed) needed to be precisely defined so I would not confuse them later when coding. I went back to my earlier research notes on the wind triangle and cross-checked definitions against a couple of flight-training sites (Online Resources) to get the wording exactly right.

### Reflection
Good progress, though I underestimated how many variables a navigation app actually needs. Having them all named and typed now should save a lot of confusion once I start writing the calculation functions. What I would do differently is build the data dictionary alongside the QA Checklist rather than fully before it, since a few fields only became obvious once I started thinking about boundary values.

### Aim for Next Week
Design the Level 1 Data Flow Diagram for the Software Model section and justify why a DFD, rather than a class diagram, storyboard, or decision tree, is the right fit for this project.

___

## Journal Entry 8 29/05/2026

### Aims
Build the Level 1 Data Flow Diagram showing route input, wind-triangle calculation, fuel calculation, the Go/No-Go decision, and NAVLOG and PDF export, and write the justification for choosing a DFD over other diagram types. This diagram needs to exist before Producing and Implementing can reference an overall system view.

### Progress
Completed the DFD (SE12-VS_LVL1_DFD.png), including the external entities (student pilot, Open-Meteo API) and data stores (aerodrome and waypoint data, aircraft profiles, saved plans). I wrote the justification comparing it against a class diagram, structure chart, storyboard, and decision tree, and noted its main limitation, being that it does not capture timing or sequencing, for example that the weather fetch is asynchronous.

### Challenges and Solutions
I initially tried to fit every feature, including the audio callouts and offline queueing, into the one diagram and it became unreadable. I asked a classmate to look at a draft (Collaboration with Peers) and they pointed out it was trying to do too much. I simplified it down to the core data pipeline and left the finer detail, such as callout timing and the offline queue, to be explained separately later in Producing and Implementing.

### Reflection
Learned that a diagram trying to explain everything ends up explaining nothing clearly. Scoping a diagram to one clear purpose and explaining the rest in writing works much better. What I would do differently next time is sketch the diagram's scope on paper first before building the actual DFD, rather than discovering it was too broad only after drawing it.

### Aim for Next Week
Start the Quality Assurance Checklist, beginning with Functionality.md, listing out concrete, checkable requirements rather than vague goals.

___

## Journal Entry 9 05/06/2026

### Aims
Write 01.Functionality.md in the QA Checklist, covering achievement of requirements, feature function, forms and input validation, API integration, and boundary values. This is the first QA Checklist page since functionality is the most basic thing the app needs to get right before usability or performance matter at all.

### Progress
Completed the table format for each sub-section and, importantly, built the boundary value table (true course, leg distance, true airspeed, wind speed and direction, magnetic variation, and custom waypoint name length) with the actual values I plan to test once those fields exist in code, for example true course rejecting -1 and 360 but accepting 0 and 359 (the boundary value table in 01.Functionality.md itself). The main concept I properly understood this week was how a boundary value table doubles as an early input validation spec, not just a testing checklist.

### Challenges and Solutions
Working out sensible boundaries for aviation values, for example why true airspeed should be capped at 300 knots, or why magnetic variation is realistically between -30 and +30 degrees in this region, took some research into typical trainer aircraft performance and Sydney Basin magnetic variation figures (Online Resources) rather than picking arbitrary numbers.

### Reflection
Having the boundary values written down before coding means I am not guessing at valid ranges later, since the checklist is basically already half of my input validation spec. What went well was researching real figures rather than guessing. What I would do differently is cross-check these figures with my client too, not just online sources, since a real student pilot might know practical limits I have not found in writing.

### Aim for Next Week
Move on to 02.Usability.md, covering UI/UX formatting, form validation messages, accessibility, and how buttons and menus should behave, all from the perspective of a pilot who cannot afford to be distracted mid-flight.

___

## Journal Entry 10 12/06/2026

### Aims
Write 02.Usability.md, focusing on what "usable in a cockpit" actually means in practice, being large readable text, adjustable sizing across devices, and an intuitive navigation flow. This matters because usability decisions made here directly shape later UI choices during the actual build.

### Progress
Completed all four subsections (UI/UX formatting, forms validation messages, accessibility, buttons/inputs/menus). The main idea I kept coming back to is that most of the app is meant for pre-flight preparation on the ground, with only checklists and audio callouts meant for use in the air, which shaped a lot of the later design decisions like the light and dark themes and large tap targets.

### Challenges and Solutions
It was hard to write "how will I check this" for usability without an actual UI to test yet. I got around this by planning to send wireframes and screenshots to my client for feedback before and after building each page (Collaboration), rather than only testing usability once everything is finished.

### Reflection
Good week, since usability becomes a lot more concrete once you frame it around a specific user (a student pilot, in a specific environment) instead of just "make it look nice". What went well was defining that user clearly. What did not go well was that I still do not have anything visual to actually show the client yet, which I will need to fix soon so feedback can start flowing before too much gets built.

### Aim for Next Week
Write 03.Performance.md and 04.Security.md, covering performance around loading times and caching, and security around XSS prevention, input sanitisation, and password hashing via Supabase.

___

## Journal Entry 11 19/06/2026

### Aims
Complete 03.Performance.md (loading times, database query efficiency, unused code or API calls, caching) and 04.Security.md (authentication, validation and sanitisation, password hashing, HTTPS). These need to be finished before Producing and Implementing can properly explain how security and performance are actually implemented in code.

### Progress
Both completed. For performance, I focused on keeping API calls to a minimum, for example only fetching weather once per Go/No-Go check rather than polling, and using a service worker to cache the app shell. For security, I planned out that I would need a shared sanitisation and escaping function for anything rendered from user input, strict validation for every numeric field, and that password hashing would be handled by Supabase rather than anything I write myself.

### Challenges and Solutions
I was not sure at this point whether I would need a custom backend for hashing passwords. After looking into Supabase's own documentation (Online Resources), I confirmed it handles hashing and session tokens itself, which simplified my security plan a lot, since I only need to enforce a client-side password policy and let the server remain the actual source of truth.

### Reflection
Realising I did not need to build my own authentication or hashing system was a relief and freed up time to focus on the calculation logic instead, which is the actual core of this project. My understanding of authentication-as-a-service tools like Supabase improved significantly this week.

### Aim for Next Week
Finish the remaining QA Checklist pages, being Compatibility and Responsiveness, Code Quality and Maintainability, Testing, Error Handling and Logging, and Deployment and Version Control, and start planning the main application flowchart.

___

## Journal Entry 12 26/06/2026

### Aims
Complete the remaining five QA Checklist pages and produce the first draft of the main application logic flowchart for Producing and Implementing. This is the last planning task before coding begins, so it needs to be finished properly rather than rushed.

### Progress
Finished 05.Compatability and Responsiveness.md, 06.Code Quality and Maintainability.md, 07.Testing.md, 08.Error Handling and Logging.md, and 09.Deployment and Version Control.md. I also drafted the main flowchart (SE12-VS_Flowchart.png), covering loading static data, registering the service worker, the home screen loop, the Route Planner input and validation cycle, wind triangle solving, NAVLOG assembly, and the PDF export branch.

### Challenges and Solutions
Drawing a flowchart that covers "select any feature from the home screen" without drawing six almost-identical diagrams was tricky. I solved this by having the flowchart focus on the Route Planner path in detail, since it is the most complex and feeds into NAVLOG, and generalising every other feature into a single "open selected screen" box, with the plan to justify each feature's own logic separately later with its own pseudocode.

### Reflection
Good week to close out the planning phase, since having all nine QA Checklist pages and a flowchart done means I finally have a concrete spec to start actually coding against, instead of working from memory of what I planned weeks ago. What went well was reusing the Route Planner detail rather than repeating it six times. What I would do differently is start the flowchart a little earlier alongside the last QA Checklist pages rather than fully after them.

### Aim for Next Week
Start the actual build, being the app shell, service worker registration, and loading the static aerodrome, waypoint, and aircraft data (Stage 0 to Stage 2 of my build plan).

___

## Journal Entry 13 03/07/2026

### Aims
Begin coding proper, targeting Stage 0 (app shell and offline service worker), Stage 1 (static aerodrome, waypoint, and aircraft data model), and Stage 2 (Supabase schema, RLS policies, and auth wiring) of my build plan. These three stages need to exist before any feature-specific code can be written, since every feature depends on the shell, the static data, and a working login.

### Progress
Stage 0, app shell and service worker. I built index.html's single-page shell with the home screen feature cards, and service-worker.js caching the app shell files cache-first so the shell loads offline once visited. Stage 1, static data model (wrote data/aerodromes.json, data/waypoints).json, and data/aircraft.json covering the Sydney Basin aerodromes with position, elevation, frequencies, circuit direction, and restrictions, based on the data dictionary from a few weeks ago. Stage 2, Supabase schema and auth (wrote supabase/schema.sql) and js/auth.js for the login, signup, and forgot-password dialog, including a client-side password policy checklist.

### Challenges and Solutions
Getting Row Level Security policies right took a few attempts. My first version let any logged-in user select from the flights table without filtering by `pilot_id`. I found this by testing with two throwaway accounts in the Supabase dashboard (Online Resources for the RLS syntax itself) and noticing account B could see account A's rows. I fixed it by adding `using (auth.uid() = pilot_id)` to every policy, which I confirmed with the same two-account test afterwards, and chose this approach since it enforces the restriction at the database level rather than relying on the client-side code to behave correctly.

### Reflection
This was a big week for actually seeing the plan become code. What went well was the earlier data modelling making the JSON files quick to write. What did not go so well was almost shipping a security hole in the RLS policies. I will test permissions with multiple accounts earlier next time, rather than after building the feature that uses them. My understanding of database-level security, as opposed to just application-level checks, improved a lot this week.

### Aim for Next Week
Build the Route Planner and NAVLOG core logic, being leg distance and course calculation, the wind triangle solver, time and ETA dead reckoning, and the fuel and reserve engine (Stage 3 to Stage 7 of my build plan).

___

## Journal Entry 14 10/07/2026

### Aims
Code the calculation core of the app, being Stage 3 (Route Planner leg distance and true course), Stage 4 (wind triangle solver), Stage 5 (time and ETA dead reckoning), Stage 6 (fuel and reserve engine), and Stage 7 (NAVLOG table assembly and jsPDF export). This is the actual heart of the project, since every other feature (Go/No-Go, the Logbook) ultimately relies on these calculations being correct.

### Progress
Stage 3 to 4, Route Planner and wind triangle, I built js/route-planner-bundle.js's leg table, the sine-rule wind-triangle solver (`solveLeg()`) producing WCA, true heading, magnetic heading, and groundspeed, plus its own hand-checkable Self-test panel (the Self-test panel output within the Route Planner page itself). Stage 5 to 6, time and ETA and fuel by adding the time and ETA preview (`validateDepartureTime()`, `addMinutesClock()`, `formatClock()`) and the fuel engine (`reserveMinutesFor()`, `fuelRequired()`, `checkFuelSufficiency()`) covering day, night, and marginal VFR reserve rules. Stage 7, NAVLOG assembly and PDF export, for this I wired js/navlog-bundle.js to read the route draft, run the same wind-triangle and fuel maths across every leg, assemble the NAVLOG table, and lazily load jsPDF from a CDN only when the user actually clicks "Export as PDF".

### Challenges and Solutions
The wind triangle gave a wrong groundspeed for a pure headwind case during self-testing. I diagnosed this by stepping through `solveLeg()` with `console.log` statements and found I had mixed up radians and degrees in one `Math.cos()` call. Rewriting the self-test cases first, using hand-checkable "nice angle" cases like a 90 degree crosswind at half the true airspeed, made this kind of bug much faster to catch going forward, which is why I kept that approach for every calculation module afterwards.

### Reflection
Writing the self-tests before or alongside the calculation functions, rather than only manually clicking through the UI, was the best decision this week. It caught the radians and degrees bug in seconds instead of me noticing a slightly wrong number on screen and not knowing why. My debugging skills improved a lot here, particularly around using self-checkable test cases instead of eyeballing output.

### Aim for Next Week
Build Go/No-Go, Checklists, Nav Page, and the Logbook, including the Supabase-backed save and the offline save queue (Stage 8 to Stage 14 of my build plan).

___

## Journal Entry 15 17/07/2026

### Aims
Code the remaining features, being Stage 8 (Nav Page aerodrome and waypoint lookups), Stage 9 to 10 (Go/No-Go personal minimums and Open-Meteo weather), Stage 11 (Checklists), and Stage 12 to 14 (save and load named routes, Logbook, and the offline save queue). Finishing these means every feature in the original QA Checklist has at least a first working version before testing begins.

### Progress
Stage 8, Nav Page, I built js/nav-page.js to look up an aerodrome by ICAO code and list nearby aerodromes and waypoints by distance. Stage 9 to 10, Go/No-Go, I built js/gonogo.js's `evaluateGoNoGo()`, comparing wind, crosswind, visibility, and cloud cover against the pilot's personal minimums, with a caution margin below the hard limit, plus a live Open-Meteo fetch as an alternative to manual entry (the Go/No-Go Self-test panel, later screenshotted as SE12-VS-Go_No-Go_Works.png). Stage 11 to 14, Checklists, save/load, Logbook, offline queue, I built js/checklists.js's per-phase tick-off UI, save and load named routes in route-planner-bundle.js, js/logbook.js reading a pilot's flights from Supabase, and an offline queue (`queuePendingSave()`, `flushPendingFlightSaves()`) so a flight saved while offline is not lost.

### Challenges and Solutions
The offline queue was the hardest part. I needed flights saved while offline to persist across a page reload and retry automatically once back online, without double-saving if the user also manually clicks retry. I solved this with a locally stored pending list, keyed so each entry is only cleared once Supabase confirms the insert succeeded, tested by toggling DevTools' Network "Offline" mode mid-save (Online Resources for the DevTools offline simulation feature itself).

### Reflection
This was the most feature-dense week of the whole project. Breaking it into clear stages beforehand, rather than just "build the rest of the app", made it much easier to keep track of what was actually done versus still in progress. What went well was the staged plan holding up under a busy week. What did not go so well was underestimating how fiddly the offline queue's edge cases would be. My skills around handling asynchronous, unreliable network conditions improved a lot this week.

### Aim for Next Week
Move into testing and evaluation, running through the QA Checklist criteria against the finished app, starting the formal test report and bug tracking documents, and checking the app in DevTools, Lighthouse, and OWASP ZAP.

___

## Journal Entry 16 23/07/2026

### Aims
Start the Testing and Evaluation phase, filling in the Test Report template, logging real bugs found while going back through each feature, and beginning the Software Evaluation comparing the finished app against the QA Checklist criteria from Research and Planning. This is the last major phase before the project is considered complete, so it needs to properly test the assumptions made all the way back in May. Also need to completely finish and edit the project video.

### Progress
Went through the app feature by feature against the QA Checklist and found four real issues I had not caught during building, which I logged in 05.Bug_Tracking_and_Fixing.md as BUG-01 to BUG-04. The Route Planner's Wind Preview panel is still manual-entry only and is not actually wired up to Open-Meteo like the Go/No-Go page is (SE12-VS-WindTriangleError.png compared against SE12-VS-Go_No-Go_Works.png). The departure-time fields say "24-hour" but the native time input can visually display as 12-hour AM/PM depending on the browser and OS, which is confusing even though the stored value is still correctly 24-hour (SE12-VS-TimeInconsistency.png). The Logbook's "log in to view your logbook" prompt can appear even while logged in, and clicking its button was actually calling `signOut()` instead of opening the login dialog, because it was reusing the account button's own click handler (SE12-VS-LogIn_Error_Logbook.png and SE12-VS-LogIn_Error_Logbook_2.png, showing the logged-in state before the click and the forced logout after it). The "Install app" button also silently does nothing on browsers that never fire `beforeinstallprompt`, even though the app already works offline via the service worker regardless of whether it is formally "installed". I also started the Functionality and Usability Evaluation write-ups, comparing what I actually built against the criteria I set back in May and June, and committed the remaining local changes and final touch-ups made while working on the project.

### Challenges and Solutions
Tracking down the Logbook login bug took a while, since the symptom (being told to log in while already logged in, and the button logging the user out) did not obviously point at the cause. I diagnosed it by checking `supabase.auth.getUser()`'s return value directly in the browser console and reading through js/logbook.js and js/auth.js side by side (Online Resources for general Supabase auth-state debugging patterns), which showed the logged-out prompt's button was just forwarding its click to the account button, and that the account button signs out if it believes a user is already logged in. Reading both files together, rather than just one in isolation, was what actually found it, and I chose to document this as a two-part fix (a dedicated click handler, plus a single shared auth-state source) rather than a quick patch, since a quick patch would not remove the underlying two-source-of-truth race condition. Issues with filming the video occured regarding having a good recorder as well as a good microphone. In order to fix this issue, I did some research and found a decent screen recorder and troubleshooted some of my mic settings.

### Reflection
Going through the app looking specifically for bugs, rather than just using it normally, turned up real issues that were not obvious during day-to-day development. What went well was finding all four issues with clear root causes rather than vague symptoms. What did not go so well was that these bugs were not caught earlier, during their own build weeks. I would build in a dedicated "find bugs" pass like this earlier next time, rather than leaving it entirely to the very end. My debugging skills improved further this week, particularly around comparing two related files side by side rather than assuming a bug lives in only the file where its symptom appears.

### Aim for Next Week
Nil. Submission
___

##### [Back to Master](/at-3-e-portfolio-vismay-swami-attempt-3/Master_ePortfolio.md)

---

##### Vismay Swami Software Engineering AT3

**Email** · vismay.swami@education.nsw.gov.au
