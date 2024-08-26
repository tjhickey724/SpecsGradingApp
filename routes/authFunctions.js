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

const Course = require("../models/Course");
const CourseMember = require("../models/CourseMember");


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

  /* 
  this middleware can be applied to any route that has a courseId parameter.
  If the user is not logged in, it will redirect to the login page.
  Otherwise, it will set the following locals:
  courseInfo: the course object
  isEnrolled: true if the user is enrolled in the course
  isTA: true if the user is a TA for the course
  isOwner: true if the user is the owner of the course
  isAdmin: true if the user is the admin
  isStaff: true if the user is a TA or the owner of the course

  */
  const authorize = async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        res.redirect("/login");
      } else {
        const id = req.params.courseId;
        res.locals.courseInfo = await Course.findOne({_id: id});
        const memberList = 
          await CourseMember.find(
              {studentId: req.user._id, 
                courseId: res.locals.courseInfo._id});

        res.locals.isEnrolled = memberList.length > 0;
        res.locals.isTA = 
            req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);  
        res.locals.isOwner = res.locals.courseInfo.ownerId == req.user._id+"";
        res.locals.isAdmin = req.user.googleemail == "tjhickey@brandeis.edu";

        res.locals.isStaff = res.locals.isTA || res.locals.isOwner;
        console.dir(res.locals);

        // give Admin access to all courses ...
        res.locals.isOwner ||= res.locals.isAdmin;
        next()
      }
    } catch (e) {
      next(e);
    }
  }
  
  const hasCourseAccess = async (req, res, next) => {
    // students, TAs, and owners have access to the course
    try {
      if (res.locals.isEnrolled || res.locals.isTA || res.locals.isOwner) {
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
      if (res.locals.isOwner || res.locals.isTA) {
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
      if (res.locals.isAdmin){
        next()
      } else {
        res.send("Only the administrator has access to this page.");
      }
    } catch (e) {
      next(e);
    }
  }

    module.exports = {
        authorize,
        isLoggedIn,
        hasCourseAccess,
        hasStaffAccess,
        isOwner,
        isAdmin,
    };
