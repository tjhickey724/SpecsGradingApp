# Overview of the Mastery Learning App

The Mastery Learning App has been designed to make it easier for faculty 
to experiment with trying out a Mastery Learning/Specifications Grading
pedagogy.

The basic idea is pretty simple.

You write down a list of 40 or so skills you want the students to master. Then every week you give an exam with one really challenging question for each skill you have introduced. The questions are graded pass/fail. If a student demonstrates mastery on a skill, they don't have to answer any of those skill questions the rest of the semester. Their grade is based solely on the set of skills that they master.

This is actually really challenging to implement in practice, even though it is easy to describe.

First you need the list of skills (which we are developing for several courses -- Calculus, Discrete Math, ...).

Then you need to make a quiz every week with a challenging question for each skill that you have introduced in the class. We're developing libraries of such challenging problems for each skill in our skill list. This makes it easy for faculty to make quizzes as they just select one from the library (and they are ordered by most recent use).

Then you need to make personalized exams for each student, with their name at the top and containing only those questions they still have to master. Our app generates these with a button press as a big LaTeX file which can then be separated into separate files, printed and auto-stapled.

Then you need to proctor the exams (no help for that), and after the students complete their proctored, on paper exams, they walk over to the upload part of the room and take photos of their answers and upload them to the app to be graded (just like the way we upload checks to be deposited).

Then you need to grade these skill-problems for hundreds of students a day or two after the exam (so they can study for the next exam). The grading is pass/fail so there is no extra credit, which makes it easier, and the app allows graders to share their feedback and select it from a dropdown list. The problems also have fully worked out solutions, so students don't need detailed feedback and they can see the TAs if they do! The app provides a nice interface for rapidly and collaboratively grading such exams.

Then you need to see who is falling behind and you need to let the students know where they stand in the course. The app provides a student portal where they can see which skills they've mastered and which they haven't (and what percent of the class has mastered those skills). It also lets the instructor see the level of mastery for all students in the class, which can be used to easily calculate their final grade!

Our experience shows that some students master skills the first time. These are the ones that usually get an A in the traditional classes. Other students take 2,3, or 4 attempts to attain mastery, but they do master the skills. These are students who would get B's, C's, D's for failures in traditional classes. With this approach they are rewarded for continuing to work on learning these skills to perfection, and since there is no partial credit, we all have much greater confidence that they actually really have mastered these skills and concepts.
