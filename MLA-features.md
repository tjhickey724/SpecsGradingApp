# MLA.MGA Features

## Logging in
Every user must log in using google authentication to see any page in this app.
When they do they are sent to the mainindex page which has links to two page:
* MGA - the Math Grading App:   used for the Math 5a, 10a, 10b courses at Brandeis
* MLA - the Mastery Learning App: used for any course that adopts the M.A.P approach to teaching

Once logged in you have access to a menubar at the top of the page which lets you
* return to Home
* logout
* view your Profile
* view the About and Stats pages
  
# MGA
We won't document this now because it is an interim feature and will be replaced by the next version of the MLA...

# MLA
The main MLA page allows you to do several things:
* join an MLA course using a 7 digit PIN
* view your courses (as a student, TA, or owner)
* create a new course (but this requires that you be white-listed by contacting the administrator running the site)

---

## /createCourse
this is only available to instructors (who are whitelisted in the app).
It asks you for the courseName and it creates a course with a 7 digit PIN and sends you to the course page.

---

## /showCourse/:courseId
this shows the course contents which vary depending on whether you are a student, TA, or the course owner.

### As a student
When a student visits a course page they can see
* the problem sets (as links to problem set pages)
* a link to see the TAs (which shows their names/emails and a link back to the course page)
* a link to see the Skills for the course (is this needed??)
* a list of each of the skills and the number of times each has been mastered
* a link to all of the problems and your responses.

---
## /showProblem
This is one of the most complex pages in the app because of the ways it can be customized.
The main idea is that the app will show the specified problem,then
if the user has answered the question, it will show their answer.
if the user has not answered it, it will show a form to get their answer.

The staff can tweak the problem so that is hidden and nothing shows when they visit this page
except a message saying it is hidden.

The staff can also specify that it is not answerable, in which case they can see the problem
and their answer if they answered it. If the didn't answer it they will not see the answer form
but instead a message saying the problem is not answerable.

The staff can also make the problem savable, so that even if they have answered it, they will
still have a form (containing their last answer) and a SAVE button instead of a SUBMIT button

The staff have their own view of the problem which does not have an answer form.

Finally, if the problem is peer reviewable, then after the user has submitted an answer,
they will be able to review others answers and see all of the answers.

These features of the problem are stored in the Problem object.




