# Mastery (Specs Grading) App
A version of this is live at [sgav3.herokuapp.com](https://sgav3.herokuapp.com/).

## Overview
This is an app designed to be used to support three innovative pedagogies, especially for large classes (> 100 students).
The three pedagogies are:
* Mastery Learning
* Specification-based Grading
* Peer Review

### Mastery Learning
For this app, we support Mastery Learning by allowing the instructor to create courses and enroll students in the course using a PIN.  Each course maintains a list of skills that the course is designed to teach. The instructor creates Problem Sets and Problems with the problem set, and labels each problem with the skill(s) required to solve the problem.  The instructor can also assign Teaching Assistants (TAs) for a course and TAs are able to grade answers to problems by creating reviews.  Reviewing an answer consists of assigning some points, providing some written feedback, and determining for each skill required by the problen whether the students has demonstrated mastery or not (This is Specificatio-based grading). If the problem settings allow it, fellow students can also review an answer.  Whenever a TA reviews an answer though, it becomes the official review and is stored in the answer itself and used for assigning class grades.

A key idea of our flavor of Mastery Learning is that students are given multiple chances to demonstrate mastery, but once mastery has been demonstrated in a set of skills ethey no longer have to attempt problems requiring only skills they have mastered. The system will highlight problems in a problem set to let the student easily see which problems they need to work on (as they requires some skill which has not yet been mastered) and which ones they can ignore (as they have mastered all of the required skills).

### Specification-based Grading
This tool also allows for specification based grading by providing checkboxes in each review form for the skills that a give problem requires and then allowing the reviewer to check the box if the answer demonstrates mastery, or not check the box if the answer does not demonstrate full mastery.  We also allow written comments for feedback and points and we allow the instructor to specify a rubric for each problem, but in pure Specs-based grading, you can ignore the points and the comments, provided the rubric has a fully worked-out answer for the problem

### Peer Review
This system also is designed to support Peer Review. The instructor (or TA) can adjust settings for a problem to allow Peer Review or not.  If it is allowed, then all students who have submitted an answer to a problem can click the "Review Others" button and they will be provided an (anonymous) answer to (anonymously) review. The Review form is exactly the same as that for the TAs and in particular, they will be able to see the Rubric with a fully-worked out example. When they have reviewed some number of answers for a problem (currently 2), they will be able to view all answers and reviews for that problem sorted lexicographically.  This allows them to learn from their peers answers, both the correct ones and the incorrect ones. They can also learn how to write good reviews by seeing the best reviews, and they can mark reviews with a thumbs-up or thumbs-down to indicate their view of the quality of that review.

The code to select an answer to review is the most complex part of this system.  The easiest approach would be to just get all of the answers to a problem and then randomly pick one to give to the reviewer.  We rejected this approach because we wanted something that would guarantee, under normal circumstances in a large class, that every answer gets roughly the same number of reviews at any given time.  A first attempt to meet this goal would be to keep track of the number of reviews of each ansewr which has not already been reviewed by the reviewer, and then to sort those answers by the number of reviews and then select a random element of that list of answers with the smallest number of reviews.  This requires that we keep track of the number of reviews of each answer, as well as a list of the reviewers for each answer.

Alas, this behaves poorly when there are only a few answers with the minimal number as then every one who is looking to review will be given one of those and in a large class this can result in dozens of simultaneous reviews of a few answers.

Our solution is to keep track of pending reviews in addition to completed reviews and to sort the list of answers by the number of reviews that are completed or pending. This requires keeping a list of the pendingreviewers for each answer and updating that list when the reviewer submits a review. 

This still has an issue... it is often the case that a reviewer will decide not to submit a review after having it assigned, e.g. by closing the browser.  They will then no longer be able to review that problem because they have an outstanding review.  If this happens frequently (which it does), it will also distort the count of reviews as there will be
problems with few reviews but many uncompleted pending reviews, and they will have low priority when assigning reviewers.

Our solution to this is to keep track of when reviews were assigned to reviewer and to then removed expired reviews (i.e. more than N minutes old), before assigning selecting an answer for a reviewer.



## Installation
To run this app locally you need to 
* Clone this repository (or [download it as a zip](archive/refs/heads/main.zip))
* Create a [Google Developer Account](https://console.cloud.google.com/) and get OAuth Credentials [(explained here)](https://developers.google.com/identity/protocols/oauth2/)
* Put those credentials in a .env file in the root directory, alongside mongodb credentials, in the format shown below:
* Ensure you're either running a MongoDB server locally or connected to MongoDB Atlas
* Start the server with `npm start`

**NOTE THAT THE OLDER `config/auth.js` FILE WILL NOT WORK WITH THIS VERSION OF THE APP - THIS VERSION USES DOTENV.** 
(This change was made to simplify deployment on Heroku.)

## .env format
The .env file has the form
``` javascript
MONGO_USER = "your mongo access"
MONGO_PW = "your mongo password"
CLIENT_ID = "your Google OAuth2.0 clientID"
CLIENT_SECRET = "your Google OAuth2.0 Secret"
CALLBACK_URL = "http://127.0.0.1:5500/login/authorized"
IS_ON_WEB = "False"
```

`CALLBACK_URL` and `IS_ON_WEB` can be left as-is for local copies, but should be changed for deployment.

<hr>

# Usage
Basic usage of the app is as follows:
* Once the app is installed, log in, generate a PIN for a new class, and send that PIN out to students. 
    * Students will be able to log in and view problems.
* To make a problem, first make a problem set (such as "Lesson 1") and then create a problem. 
    * Problem sets can be visible or invisible.
* TAs and professors can create skills, which can be attached to problems.

<hr>

# Features still missing
* No way to change password yet
    * (This is a particular issue for Google users, who have no ability to set a password for usage in local login route)
* About page is incomplete
* Many pages are essentially undocumented
* App does not contain any new features in the main professor/student routes

# CREDITS
The original version of this app was created initially by Tim Hickey, with contributions by Ella Tuson. Bootstrap 5.2.0 overhaul by Viridia Weiss.
