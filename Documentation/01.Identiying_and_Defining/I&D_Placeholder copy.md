# Identifying and Defining the Problem

---

## Problem Being Addressed

In aviation, there is a great amount of planning and preparation that must be done prior to flight. This along with maintaining the course and keeping track of journey progress without proper instruments can be very overwhelming. Especilly as a student pilot flying in smaller, less technologically advanced planes, the large number of checklists as well as the frequency that these need to be conducted at can cause large amounts of stress. The innacurate completion of these could also result in the pilot getting lost especially during their solo flights.  

## Overview of Software Being Created

To combat this issue, I aim to create a Web App which is able to set reminders and ensure that the pilots are staying on track time-wise as well as fuel-wise. This will allow for the minimisation of stresses when plannign for a flight with the management/calculation of fuel, time, and the navigational requirements. I aim to be able to establish this such that it will be able to calculate time taken and ETAs to waypoints as well as set reminders for where and when climbs and descents need to occur.

The VFR Navigation Log Generator is a browser-based planning tool designed for trainee pilots and flight students operating in the Sydney Basin training area. Its primary purpose is to help a student pilot convert a planned route which is a series of waypoints with distances and True Courses into a fully calculated, printable NAVLOG (Navigation Log) that satisfies the legal requirements of CAR 78 (Civil Aviation Regulations).

The program takes the effort and arithmetic out of flight planning so the student can focus on understanding why each number exists, rather than spending 30 minutes doing manual wind triangle calculations on a flight computer before every training flight. All outputs including headings, times, fuel figures, and reminder alerts are calculated automatically from the inputs the user provides.

## Scope and Boundaries

It will: 
* Calculate fuel required for legs based off aircraft type and distance
* Calculate approximate time required for each leg
* Remind the user of when certain checklists/actions should be conducted based off inputs from pilot prior to flight
* Create a printable PDF document with the NAVLOG
* Complete wind triangle calculations
* Preload aerodrome frequencies 
* Have a common list of VFR features used
* Display pre-flight checklists

It will not:
* Track the user based off GPS
* Be able to communicate with towers or conduct and of the required actions
* Include all airfields within NSW but only major airfields in Sydney utilised by training pilots.
* Have real-time weather
* Have IFR planning
* Include weight and balance calculations

## Ideal Audience and Use

The ideal audience for this would be student pilots who are currently in the process of developing their flight management and navigational skills. This will help the users to remember to conduct various navigational checks at checkpoints and allow for the management of flight awareness. It will also be useful to minimise the amount of fuel utilised during the journey saving the student extra fees on top of the already expensive process of achieving their license. More specifically:

1. Primary Users:
    * Trainee pilots/student pilots (RPL / PPL students) in Australia, primarily those training at Sydney Basin aerodromes such as Bankstown (YSBK) and Camden (YSCN).
    * These users:
        * Are learning cross-country navigation for the first time
        * Are not yet fluent with the E6-B flight computer or manual wind triangle calculation
        * Are familiar with the Sydney VTC and common local landmarks (PSP, 2RN, Nepean River, M7, etc.)
        * Need to produce a NAVLOG before each supervised cross-country flight
        * May use the program in a classroom or home study environment, before attending the aerodrome

2. Secondary Users:
    * Flying instructors checking or reviewing a student's pre-planned NAVLOG before flight
    * Ground school students learning navigation theory and using the tool to verify their manual calculations

## Constraints

Due to levels of knowledge and access to hardware and software, the product will be restricted in the way that it functions such that, it may not be as efficient and may not be able to provide visual references such as a live GPS. Furthermore, due to this lack in technology, we also may not be able to track and manage the data accurately as there can always be redirections based on live issues and instructions given by the ATC. The features will also be limited to airfields within the Sydney region only due to the shear scale of this project as well as the lack of technology and skill.

## Assumptions being made

Assumptions being made include:
* The pilot knows their route prior to starting the flight
* No changes made by ATC

---

##### Vismay Swami Software Engineering AT3

**Email** · vismay.swami@education.nsw.gov.au