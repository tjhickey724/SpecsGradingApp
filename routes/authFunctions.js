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
  const authorizeOLD = async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        res.redirect("/login");
      } else {
        const id = req.params.courseId;
        const course = await Course.findOne({_id: id});
        res.locals.courseInfo = course;
        const memberList = 
          await CourseMember.findOne(
              {studentId: req.user._id, 
                courseId: course._id});
        const member = memberList.length>0?memberList[0]:{};
                
        res.locals.isOwner = course.ownerId == req.user._id+"";
    
        res.locals.isAdmin = req.user.googleemail == "tjhickey@brandeis.edu";


        res.locals.isMgaStudent = member.role=='student'
                                  && course.nonGrading;
        
        res.locals.isEnrolled = member.role=='student';
            //(memberList.length > 0 && !res.locals.courseInfo.nonGrading);
        
        res.locals.isTA = memberList.role.includes('ta');
            //(req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id));




        res.locals.hasCourseAccess = res.locals.isEnrolled || res.locals.isTA || res.locals.isOwner;
        res.locals.isStaff = res.locals.isTA || res.locals.isOwner;
        

        // give Admin access to all courses ...
        //res.locals.isOwner ||= res.locals.isAdmin;
        next()
      }
    } catch (e) {
      next(e);
    }
  }


  const authorize = async (req, res, next) => {
    try {
      // only logged in users on routes with courseId can be authorized
      if (!req.isAuthenticated() || !req.params.courseId) {
        res.redirect("/login");
      } else {
        const id = req.params.courseId;
        res.locals.courseInfo = await Course.findOne({_id: id});
        const member = 
          await CourseMember.findOne(
              {studentId: req.user._id, 
                courseId: res.locals.courseInfo._id});
         
        res.locals.isAdmin = req.user.googleemail == "tjhickey@brandeis.edu";
        if (!member){
            // these should all be false for new courses
            // but we want to be backward compatible so ...
            res.locals.isOwner = 
                res.locals.isAdmin 
                || res.locals.courseInfo.ownerId == req.user._id+"";
            res.locals.isMgaStudent = false;
            res.locals.isEnrolled = false;
            res.locals.isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
        } else {
            res.locals.isOwner 
              = member.role=='owner' 
                || res.locals.isAdmin 
                || res.locals.courseInfo.ownerId == req.user._id+"";
            res.locals.isEnrolled = member.role=='student';         
            res.locals.isTA = member.role=='ta';
            res.locals.isMgaStudent = res.locals.courseInfo.nonGrading; 
        }

        res.locals.hasCourseAccess 
            = res.locals.isEnrolled 
              || res.locals.isTA 
              || res.locals.isOwner;
        res.locals.isStaff 
            = res.locals.isTA 
              || res.locals.isOwner;

        // give Admin access to all courses ...
        //res.locals.isOwner ||= res.locals.isAdmin;
        console.log('after authorize');
        console.dir(res.locals);
        next()
      }
    } catch (e) {
      next(e);
    }
  }

  const hasMGAStudentAccess = async (req, res, next) => {
    // students, TAs, and owners have access to the course
    try {
      if (res.locals.isMgaStudent 
          || res.locals.isEnrolled
          || res.locals.isTA 
          || res.locals.isOwner) {
        next();
      } else {
        res.send("You do not have access to this course.");
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
      console.log(`isTA=${res.locals.isTA} isOwner=${res.locals.isOwner}`);
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
      if (req.user.googleemail == "tjhickey@brandeis.edu"){
        res.locals.isAdmin = true;
        next()
      } else {
        res.send("Only the admin has access to this page.");
      }      
    } catch (e) {
      next(e);
    }
  }

    module.exports = {
        authorize,
        isLoggedIn,
        hasMGAStudentAccess,
        hasCourseAccess,
        hasStaffAccess,
        isOwner,
        isAdmin,
    };
