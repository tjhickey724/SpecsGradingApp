var express = require("express");
var app = express.Router();
const fs = require('fs');
const Answer = require("../models/Answer");


/*
  Authentication Middleware 
  There are five levels of authentication 
  1. not logged in
  2. user: logged in
  3. student: logged in and enrolled in a course
  4. ta: logged in and TA for a course
  5. owner: logged in and owner of a course
We set the authorization checking so that 
the user must be logged in to access any of route except "/login"
*/
// route middleware to make sure a user is logged in
const isLoggedIn = (req, res, next) => {
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.loggedIn = true;
    return next();
  } else {
    res.redirect("/login");
  }
}

const hasCourseAccess = async (req, res, next) => {
  // students, TAs, and owners have access to the course
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;
    res.locals.isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user._id+"";
    if (res.locals.isOwner|| res.locals.isEnrolled || res.locals.isTA) {
      next();
    } else {
      res.send("You do not have access to this course.");
    }
  } catch (e) {
    next(e);
  }
}

const hasStaffAccess = async (req, res, next) => {
  // Teaching Staff and Owners have access to the course route
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = 
        await Course.findOne({_id: id}, "name coursePin ownerId");
    res.locals.isTA = 
            req.user.taFor 
         && req.user.taFor.includes(res.locals.courseInfo._id);

    if (res.locals.courseInfo.ownerId == req.user._id 
        || res.locals.isTA) {
      next();
    } else {
      res.send("Only TAs and the owner have access to this page.");
    }
  } catch (e) {
    next(e);
  }
}

const isOwner = async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");
    // the ownerId is a string and the user._id is an object
    // so we need to add "" to the user._id to make them the same type
    // before testing for equality
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user._id+"";
    if (res.locals.isOwner) {
      next();
    } else {
      res.send("Only the owner has access to this page.");
    }
  } catch (e) {
    next(e);
  }
}


const isAdmin = async (req, res, next) => {
  try {
    if (req.user.googleemail == "tjhickey@brandeis.edu"){
      next()
    } else {
      res.send("Only the administrator has access to this page.");
    }
  } catch (e) {
    next(e);
  }
}

app.get("/downloadAnswers/:courseId/:probId", hasCourseAccess,
  async (req, res, next) => {
    try {
      const probId = req.params.probId;
      res.locals.probId = probId;
      const answers = await Answer.find({problemId: probId}).populate('studentId');
      const csvStream = fs.createWriteStream("private/"+probId+".csv")
      csvStream.write("filename,created_at,full_name\n")
        for(let x of answers) {
            const writeStream = fs.createWriteStream("private/"+probId+"-"+x.studentId.googleemail);
            writeStream.write(x.answer)
            csvStream.write(""+probId+"-"+x.studentId.googleemail+","+x.createdAt+","+x.studentId.googleemail+"\n")
            writeStream.end()
        }
        csvStream.end()

      res.json(['testing']);
    
    } catch (e) {
      console.log("Error in showProblem: " + e);
      next(e);
    }
  });
  

module.exports = app;
