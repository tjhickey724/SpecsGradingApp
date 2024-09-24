# The Mastery Learning App
The Mastery Learning App has been designed to help faculty teach courses using the 
Mastery Assessment Pedagogy (M.A.P.) approach which has been used in Brandeis University
to teach the PreCalculus and Calculus sections and which has been studied and analyzed
in Dr. Ella Tuson's recent PhD Dissertation, 
"M.A.P. — Mastery Assessment Pedagogy for Learning Computer Science"

This software is open source ([GNU Affero GPLv3.0](https://github.com/tjhickey724/SpecsGradingApp/blob/main/LICENSE)) and you are free to download it and modify it and run it on your own servers and you can use it to teach your classes, or you can ask to use our servers (email to tjhickey@brandeis.edu).

# Mastery Learning App User's Guide

The goal of this app is to help make it easier for faculty to try out the M.A.P. approach
by providing libraries of skills and problems and software for managing the mechanics of
such a course. We describe this approach and the app in more detail below. 

## Mastery Assessment Pedagogy
There can be variations to this approach, but this app is designed for a very particular style of pedagogy
which has four key components:
1. **Skills** The course has a clearly specified list of measureable learning objectives, which we call skills. The goal is for students to demonstrate mastery of all of the skills. The course grade is completely determined by the set of skills the student masters. Such lists typically have 30-50 skills
2. **Weekly Skill-based Exams** The students are given a written exam every week (or two) covering all of the skills introduced so far. There is one question per skill. The questions are designed to rigorously assess student mastery and are often perceived to be hard but fair. The pass rate on individual questions is typically around 50%, but the course pass rate for skills, after being given multiple attempts to demonstrate mastery, is typically around 80-100%.
3. **Pass/Fail grading on skills** The student answers are graded pass/fail, where a pass means the student has clearly demonstrated mastery of the specified skill. After the exam, the student is given access to a fully worked out solution, and they may receive some minimal feedback about where they went wrong or how to study to pass this skill in the next exam. If a student demonstrates mastery on a skill by answering the question correctly, they will no longer be questioned on that skill. Thus each week the questions on the quiz will vary from student to student. Those students who have mastered all skills so far will only see the new skills introduced that week. Other students will have questions on skills they have previously attempted but not mastered.
4. **Personalized proctored exams on paper** The exams are given on paper, with one page per question, in a proctored exam. Each student has a personalized exam with their name on the title page and only those problems they have not yet mastered appear in their copy of the exam. Once they complete the exam they walk over to the "uploading" part of the room, take photos of their exam pages with their phone, and upload the photos to the cloud for grading.



## Challenges with teaching a M.A.P. class
We have used this style of teaching in courses in Discrete Math and it has been used in PreCalculus and Calculus courses. There are a number of bookkeeping challenges that the MLA is designed to simplify.

1. Building a list of measureable skills and a library of challenging problems for that skill.
2. Creating personalized exams (and personalized makeup exams) every week.
3. Rapidly grading the personalized exams so students can see which skills they must study for next week
4. Clearly communicating to the students which skills they have mastered and which they have not.

There are several ways that this app can be used, depending on how much of the course you want the app to handle. We'll review the basic approaches below.

## MGA - the Mastery Grading App
Some faculty may already have developed a method for creating personalized exams based on a list of their own skills, and may simply want a way to clearly communicate to the students what their status is, as well as to review the progress of the entire class.  For this approach, faculty can use the Mastery Grading App, which is one component of the MLA.  It requires the faculty to upload 
1. a roster.csv file of the students in the class with their name, email and section(and to update it as students change sections and add/drop classes)
2. a gradesN.csv file recording the set of skills that each student has mastered in Exam N with their name, email, and a 0 or 1 for each skill introduced so far. Currently skills also have a letter label (e.g. F1,F2,..., G1,G2, ...) where F is for a fundamental skill and G is for a general skill. Faculty can specify that a certain number of fundamental skills must be met to pass the course! 

This approach requires faculty to create their own list of skills, and questions for each skill, and to create and grade the exams every week. Some faculty may want to have exams every other week, alternating with makeup exams for students who missed the original exam.

### Access to the app
Faculty can create a class by sending email to tjhickey@brandeis.edu to be added to the whitelist of instructors. The faculty view shows how each student did on each exam, and also shows which skills
each student has mastered.

Students access the app using google authentication on their gmail account.
The student view shows each skill and the percentage of the class that has mastered that skill, and whether or not the student has mastered the skill.

## MLA and Skill/Problem Libraries

Another approach which offloads more of the work to the app is to use the MLA Skill and Problem Libraries.
These are shared course resources (which require the owners permission to access and extend) of lists of skills for a particular course and libraries of problems for each skill in that course. We currently have libraries for 4 courses
1. PreCalculus
2. Differential Calculus
3. Integral Calculus
4. Discrete Math
and we are working on libraries for some introductory courses on Python programming as well as other more advanced topics such as Compiler Design.  The app is designed to easily allow faculty to share their skill lists and problem libraries, and for them to customize the skill lists and problems without changing the original skill lists and libraries.  If you want access to any of these courses, please contact me at tjhickey@brandeis.edu

The MLA has many features designed to simplify the creation and administration of personalized skill exams. We describe these features below.

### Creating a course
Once you are on the white list, you can create an MGA course and an MLA course and link the two together.
A course consists of a list of skills, and a list of problem sets (which is our name for the exams),
and a list of the Teaching Assistants. It still requires the grading to be done on another app and the grades and roster uploaded to the associated MGA course as csv files.

#### Creating the skill list
For the MLA course you can import a list of skills from another course that you have access to
(e.g. from our PreCalculus course) and/or you can create your own skills. This imports copies of the
skills but has a link to the original skill. 
You can also delete or modify any of the skills in your course without changing the original skill (if any).

#### Creating a problem set
After you create the skills you can create problem sets which is the name we have for the weekly exams.
A problem set consists of a set of problems, each one associated to a skill. 

#### Creating a problem in a problem set.
You can either create a new problem (where you will be prompted for the problem text, rubric, skills, name, etc.) or you can search for a problem in the problem library by specifying a skill and finding all problems containing that skill in all courses for which you have been given access. Since skills can be shared, we actually look for all skills that are derived from the current skill (or from its original skill if it is an imported skill). This allows faculty to add to their own problems to the library for a given skill and to see the problems created by any colleagues that have given them access to their course.

The problems can be written in plain text, or markdown, or LaTeX. When searching for problems for a particular skill, they are ordered chronologically according to their last use in a course you have access to. This allows you to attempt to avoid problems that have been used in the recent past. 

#### Creating and administering a personalized exam
Once you have linked your MLA course with an MGA course, you can press the "create a personalized exam"
button which will determine the set of skills each student in the MGA class has mastered and will then
generate a LaTeX file with one exam for each student (and their name/email is at the top of the first page).
You can turn this into a pdf by downloading it and running the pdflatex command. It requires a few additional files: (preamble.tex, title.tex) which provide information about the policies for the exam that are copied into each student's exam.

If the personalized exam contains markdown questions you need to use the following command to generate the pdf
``` bash
latexmk -cd -pdf -shell-escape -silent MARKDOWN-TEX-FILENAME.tex
```
You can read more about converting markdown to pdf in latex at
[Markdown Package Manual](https://mirror.las.iastate.edu/tex-archive/macros/generic/markdown/markdown.html)

This big pdf can be processed by a printing center so that each exam is printed and stapled independently. (MORE DETAILS TO FOLLOW). For a large class the teaching staff can lay out the exams in the exam room ahead of time, in alphabetical order and students can move to their assigned seating to take the exam. After they complete, they upload the exam to the cloud where it can be graded. For this version, we are assuming the instructor has their own method for uploading and grading exams and the results can then be uploaded to the corresponding MGA course. We are currenlty building a version of the MLA that incorporates this uploading/grading component, but it is not fully operational.

#### Creating a Makeup Exam
For large class there will often be some students who can not take a given exam. In that case, we can create a problem set corresponding to the makeup exam and specify that it is a makeup of a particular already graded MGA exam. When you generate a personalized exam for a problem set that is a makeup, it will only generate exams for students who missed the specified exam.

## Future Plans - adding exam grading and online access to the MLA
The current version of the MLA allows the instructor to give students access to the MLA course so that they
can upload their answers directly to the app, and the teaching assistants can grade the answers and have them automatically stored in the app, but these features are somewhat limited for now.

For the present, students can only upload plain text answers which can include links to photos of their exams on google drive or some other platform. The grading feature allows instructors to review an answer and specify whether it demonstrates mastery by checking a checkbox. They can also provide plaintext feedback. We do not yet have a way of rendering the LaTeX for the problems in a way that students can see the problem, but that is our next step. We also have not integrated the personalized exams with the MLA-grading results, but again we will soon add that feature.

# Other links
* [Installing MLA locally](./installation.md)
* [MLA Overview](./MLAoverview.md)
* [MLA architecture](./MLA-architecture.md)
* [old README](./oldREADME.md)
* [MLA Feature List (for testing and debugging)](./MLA-features.md)
