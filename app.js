// Start/restart this with
// pm2 start bin/www -n mastery -i 3
// restart with
// pm2 restart mastery
// get help with
// pm2

// here are the standard requires for an express app
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const showdown  = require('showdown');
const converter = new showdown.Converter();
const multer = require("multer");

const aws = require('aws-sdk'); //"^2.2.41"
const multerS3 = require("multer-s3");
const cors = require("cors")();

require("dotenv").config();


if (process.env.UPLOAD_TO == "AWS") {
  const aws_config = {
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    region: process.env.AWS_REGION,
  };
  console.dir(aws_config);
  aws.config.update(aws_config);

  const s3 = new aws.S3();
  const storageAWS = multerS3({
    s3: s3,
    //acl: 'public-read',
    bucket: process.env.AWS_BUCKET_NAME,
    key: function (req, file, cb) {
        req.suffix = file.originalname.slice(file.originalname.lastIndexOf('.'));

        
        cb(null, req.filepath+req.suffix); //use Date.now() for unique file keys

        //cb(null, file.originalname); //use Date.now() for unique file keys
    }
  })
}

const storageLocal = multer.diskStorage({
  destination: function(req, file, cb) {
      console.log('in storageLocal.destination');
      cb(null, 'public')
  },
  filename: function(req, file, cb) {
      req.suffix = file.originalname.slice(file.originalname.lastIndexOf('.'));

      console.log('in storageLocal.filename');
      console.log(`file=${JSON.stringify([req.filepath,file])}`);
      //const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, req.filepath+req.suffix)//+file.originalname)
  }
})

const upload = 
  (process.env.UPLOAD_TO=='AWS')?
    multer({ storage: storageAWS })
    :
    multer({storage: storageLocal});

const memoryStorage = multer.memoryStorage()
const memoryUpload = multer({ storage: memoryStorage })

/*
 here is code we can use to delete an uploaded file
   await unlinkAsync(file_path)
   https://stackoverflow.com/questions/49099744
*/
const fs = require('fs')
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink)




// Routes
const reviews = require('./routes/reviews');
const auth = require('./routes/authRouter');
const similarity = require('./routes/similarity');
const mathgrades = require('./routes/mathgrades');
const updates = require('./routes/updates');


// Models!
const Course = require("./models/Course");
const CourseSkill = require("./models/CourseSkill");
const ProblemSet = require("./models/ProblemSet");
const Problem = require("./models/Problem");
const Answer = require("./models/Answer");
const Review = require("./models/Review");
const User = require("./models/User");
const CourseMember = require("./models/CourseMember");
const Skill = require("./models/Skill");
const RegradeRequest = require("./models/RegradeRequest");
const MathCourse = require("./models/MathCourse");
const MathExam = require("./models/MathExam");
const MathGrades = require("./models/MathGrades");
const MathSection = require("./models/MathSection");
const ejsLint = require("ejs-lint");


const upload_to = process.env.UPLOAD_TO; // AWS or LOCAL

if (process.env.UPLOAD_TO == "AWS") {
  // ...
}



// AUTHENTICATION MODULES
// TJH - why are these not defined with "CONST" declarations??
// TJH - make sure we need all of these ...
(session = require("express-session")), 
(bodyParser = require("body-parser")), 
(flash = require("connect-flash"));
// This allows the session variables to be stored in the database
// so we can use multiple servers with the same session data
const MongoStore = require("connect-mongo")(session);
// END OF AUTHENTICATION MODULES

// INITIALIZING THE MONGOOSE DATABASE CONNECTION
const mongoose = require("mongoose"); 

// we load the mongoose server data from the .env file
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("we are connected!!!");
});

/*
  Whitelist of instructors who are able to create courses on the MLA.
  For now it is just me, but we can add more instructors as needed.
*/
const instructors = [
  "tjhickey@brandeis.edu",
  "tjhickey724@gmail.com",
  "timhickey@me.com",
  "jamespetullo@brandeis.edu",
  "rtorrey@brandeis.edu",
  "merrill2@brandeis.edu",
];

var app = express();



var http = require("http").Server(app);

// TJH - I don't think we need this any more
var io = require("socket.io")(http);

/*
Authentication middleware:
  isLoggedIn - checks if the user is logged in
  isAdmin - checks if the user is an admin
The rest of these middleware function assume that the user is logged in
and that there is a request parameter named :courseId
and that the authorize middleware has been invoked first.
  hasCourseAccess - checks if the user is enrolled in the course
  hasStaffAccess - checks if the user is a TA or the owner of the course
  isOwner - checks if the user is the owner of the course
This middleware function assumes that the user is logged in
and that there is a courseId parameter in the request
and it sets the local variables in res.locals for
isEnrolled, isTA, isOwner, isStaff, is Admin
  authorize - checks if the user is logged in and has access to the course
Every route that requires authentication for access to a course
should start with the authorize middleware and then will have those
functions available in res.locals.
*/
const {isLoggedIn, hasMGAStudentAccess, hasCourseAccess, hasStaffAccess, isOwner, isAdmin, authorize} = require('./routes/authFunctions.js');


// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// TJH - this needs more explanation ...
app.disable('etag'); // get rid of 304 error?

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors);
/*************************************************************************
     HERE ARE THE AUTHENTICATION ROUTES
**************************************************************************/

// this is used to allow for session variables, which are used for authentication
app.use(session(
  {
    secret: "zzbbyanana",
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 24 * 60 * 60 * 1000}, // allow login for one day...
    store: new MongoStore({mongooseConnection: mongoose.connection}),
  })
);

// TJH - I don't think we are sending flash messages  
app.use(flash());

app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(auth);
app.use(similarity);
app.use(updates);





/*
The main page of this app "/" provides access to multiple
apps that are part of the Mastery Learning Project. Currently
we have access to
  - the Math Grades App
  - the Mastery Learning App 
*/



app.get('/', (req, res) => {
  res.redirect('/mla_home');
});

app.get('/mga_home', (req, res) => {
  res.redirect('/mathgrades');
});


app.use('/mathgrades',mathgrades);

//const approvedLogins = ["tjhickey724@gmail.com", "csjbs2018@gmail.com"];

/* 
  this handles all routes dealing with reviews
  the user must have proper authentication to access these routes
*/



app.get("/mla_home", isLoggedIn, (req,res) => {
  res.redirect("/mla_home/showCurrent");
});

app.get("/mla_home/:show", isLoggedIn,
  async (req, res, next) => {
  /*
    this is the main page with links to all of the courses
    the user is enrolled in or teaching. It only requires that
    they be logged in and they can create a new course or join an
    existing course if they have the course pin.
  */
  

  if (!req.user) next();
  const userId = req.user._id;
  const coursesOwned = await Course.find({ownerId: userId});

  const registrations = await CourseMember.find({studentId: userId,role:'student'}, "courseId");
  const registeredCourses = registrations.map((x) => x.courseId);
  const coursesTaken = await Course.find({_id: {$in: registeredCourses}});
  
  const taRegistrations = await CourseMember.find({studentId: userId,role:'ta'}, "courseId");
  const taRegisteredCourses = taRegistrations.map((x) => x.courseId);
  const coursesTAing = await Course.find({_id: {$in: taRegisteredCourses}});

  //const coursesTAing = await Course.find({_id: {$in: req.user.taFor}});
  const title = "PRA";
  const routeName = " index";
  const show = (req.params.show=="showAll")?'showAll':'currentOnly';
  console.log(`show is ${show}`);

  res.locals = {
    ...res.locals,
    title,
    routeName,
    coursesOwned,coursesTAing,coursesTaken,
    show,
  };

  res.render("index");
});


app.get("/about", isLoggedIn,
  (req, res, next) => {
  res.locals.routeName = " about";
  res.render("about");
});

app.get("/profile", isLoggedIn,
  async (req, res, next) => {
  if (res.locals.entryNum == undefined) {
    res.locals.entryNum = "all";
  }
  res.locals.routeName = " profile";
  res.render("showProfile");
});

app.post("/profile", isLoggedIn,
  async (req, res, next) => {
  res.locals.entryNum = req.body.enNum;
  res.locals.routeName = " profile";
  res.render("showProfile");
});

app.get("/stats", isLoggedIn,
  async (req, res, next) => {
  let courseCount = await Course.find().count();
  let userCount = await User.find().count();
  let problemCount = await Problem.find().count();
  let answerCount = await Answer.find().count();
  let reviewCount = await Review.find().count();
  let courses = await Course.find({}, {name: 1});
  let googleemail;
  if (typeof req.user !== "undefined") {
    googleemail = req.user.googleemail;
  } else {
    googleemail = "";
  }
  res.locals.routeName = " stats";
  res.render("stats.ejs", {courseCount, userCount, problemCount, answerCount, reviewCount, courses, googleemail});
});




app.get("/createCourse", isLoggedIn,
  (req, res) => {
    if (instructors.includes(req.user.googleemail)){
      res.render("createCourse");
    } else {
      res.send("You must be an instructor to create a course. Contact tjhickey@brandeis.edu to be on the MLA instructors list.");
    }
});

// rename this to /createCourse and update the ejs form
/*
  This creates a new course and if it is a nonGrading course,
  then it also creates the corresponding Math course and links them
  together. The /showCourse route checks to see what the courseType is
  and if it is an exam_generation or exam_reporting course, then it
  will redirect to the MathCourse route.
*/
app.post("/createNewCourse", isLoggedIn,
  async (req, res, next) => {

  if (false && !req.user.googleemail.endsWith("@brandeis.edu")) {
    res.send("You must log in with an @brandeis.edu account to create a class. <a href='/logout'>Logout</a>");
    return;
  } else if (!(req.body.norobot == "on" && req.body.robot == undefined)) {
    res.send("no robots allowed!");
    return;
  }
  try {
    let coursePin = await getCoursePin();
  
    let newCourse = new Course({
      name: req.body.courseName,
      ownerId: req.user._id,
      startDate: new Date(req.body.startDate),
      stopDate: new Date(req.body.stopDate),
      courseType: req.body.courseType,
      nonGrading: ["exam_reporting", "exam_generation"].includes(req.body.courseType),
      coursePin: coursePin,
      createdAt: new Date(),
    });


    let theCourse = await newCourse.save();
    // create a courseMember entry for the owner
    let registration = {
      studentId: req.user._id,
      courseId: theCourse._id,
      role: "owner",
      createdAt: new Date(),
    };
    let cm = new CourseMember(registration);
    await cm.save();

    if (theCourse.nonGrading){
      // create an MGA course and link it to this course.
      let newMathCourse = new MathCourse({
        name: req.body.courseName,
        ownerId: req.user._id,
        coursePinMLA: theCourse.coursePin,
        courseId: theCourse._id,
        createdAt: new Date(),
      });
      let theMathCourse = await newMathCourse.save();
      newCourse.mathCourseId = theMathCourse._id;
      await newCourse.save();
      }
    res.redirect("/mla_home");
  } catch (e) {
    next(e);
  }
});

async function getCoursePin() {
  // this only works if there are many fewer than 10000000 courses
  // but that won't be an issue with this alpha version!
  let coursePin = Math.floor(Math.random() * 10000000);
  let lookupPin = await Course.find({coursePin: coursePin}, "coursePin");

  while (lookupPin.length > 0) {
    coursePin = Math.floor(Math.random() * 10000000);
    lookupPin = await Course.find({coursePin: coursePin}, "coursePin");
  }
  return coursePin;
}

/*
All routes below here must start with a courseId parameter
*/

app.use(reviews);


app.post("/changeCourseName/:courseId", authorize, isOwner,
  async (req, res) => {
    const name = req.body.newName;
    const startDate = req.body.startDate;
    const stopDate = req.body.stopDate;
    const nonGrading = req.body.nonGrading == "true";
    console.log(`req.body=${JSON.stringify(req.body)}`);
    const course = await Course.findOne({_id:req.params.courseId});
    course.name = name;
    course.startDate = new Date(startDate);
    course.stopDate = new Date(stopDate);
    course.nonGrading = nonGrading;
    await course.save();
    res.redirect("/showCourse/"+req.params.courseId);
});

app.get("/showRoster/:courseId", authorize, hasStaffAccess, 
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = 
        await CourseMember
              .find({courseId: res.locals.courseInfo._id})
              .populate('studentId');
    const members = memberList.map((x) => x.studentId);

    res.locals.members = members;//await User.find({_id: {$in: memberIds}});
    res.locals.memberList = memberList;

    res.locals.routeName = " showRoster";
    res.render("showRoster");
  } catch (e) {
    next(e);
  }
});

app.get("/dumpStats/:courseId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    const memberIds = memberList.map((x) => x.studentId);
    const members = await User.find({_id: {$in: memberIds}});
    const grades = 
        await Answer.find({courseId:id,studentId:{$in: memberIds}})
              .populate('skills')
              .populate('studentId')
              .populate('psetId')
              .populate('problemId')
                ;
    res.json(grades);
  } catch (e) {
    next(e);
  }
});

app.post("/addStudents/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    let emails = req.body.emails.split("\n").map((x) => x.trim());
    for (let e of emails) {
      let z = await User.findOneAndUpdate({googleemail: e}, {googleemail: e}, {upsert: true, new: true});
      let registration = {
        studentId: z._id,
        courseId: id,
        createdAt: new Date(),
      };
      let cm = await CourseMember.findOneAndUpdate({studentId: z._id, courseId: id}, registration, {upsert: true, new: true});

    }
    let users = await User.find({googleemail: {$in: emails}});

    res.redirect("/showRoster/" + id);
  } catch (e) {
    next(e);
  }
});


/*
  showCourse is the main page for a course
  which can only be viewed by course members
  (students, TAs, and the owner)
  it shows the course information, the sets, 
  and the course skills that the user has mastered
*/
app.get("/showCourse/:courseId", authorize, hasMGAStudentAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    const course = await Course.findOne({_id: id});
    if (course.nonGrading && !res.locals.isStaff) {
      res.redirect("/mathgrades/showCourse/" + course.mathCourseId);
    } else {
      res.redirect("/showMLACourse/" + id);
    }
  } catch (e) {
    next(e);
  }
});


app.get("/showMLACourse/:courseId", authorize, hasMGAStudentAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id});

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});
    // next we create maps to find the number of problems and user's answers
    // in each problem set so the user will know if they have finished a problemset
    let problems = await Problem.find({courseId: res.locals.courseInfo._id});
    let myAnswers = await Answer.find({courseId: res.locals.courseInfo._id, studentId: req.user._id});

    let problemMap = new Map(); // counts the number or problems in each problemset
    let answerMap = new Map(); // counts the number of the user's answers to problems in each problemset 
    for (let problem of problems) {
      let count = problemMap.get(problem.psetId.toString());
      if (count) {
        problemMap.set(problem.psetId.toString(), count + 1);
      } else {
        problemMap.set(problem.psetId.toString(), 1);
      }
    }
    for (let answer of myAnswers) {
      let count = answerMap.get(answer.psetId.toString());
      if (count) {
        answerMap.set(answer.psetId.toString(), count + 1);
      } else {
        answerMap.set(answer.psetId.toString(), 1);
      }
    }
    res.locals.problemMap = problemMap;
    res.locals.answerMap = answerMap;

    // Count the number of thumbs up and thumbs down for the user's reviews
    // and send the user's reviews to the page
    let myReviews = await Review.find({courseId: res.locals.courseInfo._id, studentId: req.user._id});
    res.locals.myReviews = myReviews;
    let thumbsUp = 0;
    let thumbsDown = 0;
    for (let r of myReviews) {
      thumbsUp += r.upvoters.length;
      thumbsDown += r.downvoters.length;
    }
    res.locals.thumbsUp = thumbsUp;
    res.locals.thumbsDown = thumbsDown;

    // check to see if the user is a TA for this course
    // and send it to the page
    res.locals.isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);


    /* 
       Find the number of times, skillCount[s] 
       that the user has mastered each skill s
       in the course...
    */

    // get the list of the student's answers for this course
    let usersAnswers = await Answer.find({studentId: req.user._id, courseId: id});
    // get the ides of all of the students answers for this course
    // let answerIds = usersAnswers.map((x) => x._id);
    // get the ids of the TAs for this course
    //let taIds = (await User.find({taFor: id})).map((x) => x._id);
    // get the reviews of the students answers that have been reviewed by TAs
    //let reviews = await Review.find({answerId: {$in: answers}, reviewerId: {$in: taIds}});

    // get the lists of skill ids for all problems the student mastered
    let skillLists = usersAnswers.map((x) => x.skills);
    let skillCount = {};
    for (slist of skillLists) {
      if (!slist) continue;
      for (s of slist) {
        skillCount[s] = (skillCount[s] || 0) + 1;
      }
    }
    res.locals.skillCount = skillCount;

    let skillIds = Array.from(new Set(flatten(skillLists)));
    res.locals.skills = await Skill.find({_id: {$in: skillIds}});
    let courseSkills = await CourseSkill.find({courseId: id}).populate('skillId');
    res.locals.allSkills = courseSkills.map((x) => x.skillId);
    //res.locals.allSkills = await Skill.find({courseId: id});
    res.locals.skillIds = skillIds; 
    // skillIds is a list of the ids of the skills the student has mastered

    res.locals.regradeRequests = await RegradeRequest.find({courseId: id, completed: false});


    let startDate = res.locals.courseInfo.createdAt
    let stopDate = new Date(startDate.getTime() + 1000*3600*24*120);
    if (res.locals.courseInfo.startDate) {
      startDate = res.locals.courseInfo.startDate;
    }
    if (res.locals.courseInfo.stopDate) {
      stopDate = res.locals.courseInfo.stopDate;
    }
    res.locals.startDate = startDate;
    res.locals.stopDate = stopDate;  
    
    console.dir(res.locals);
    if (res.locals.hasCourseAccess) {
      res.render("showCourse");
    } else if (res.locals.isMgaStudent) {
      res.render("showCourseMGA");
    } else {
      res.send("You do not have access to this course.");
    }
  } catch (e) {
    next(e);
  }
});

const flatten = (vals) => {
  let flist = [];
  for (x of vals) {
    flist = flist.concat(x);
  }
  return flist;
};


/* 
  this route is used to proess a request to join a course 
  by entering the course pin 
*/

app.post("/joinCourse", isLoggedIn,
  async (req, res, next) => {
  try {
    const userId = req.user._id;
    const coursePin = req.body.coursePin;

    // look up the course with the given course pin
    const course = await Course.findOne({coursePin: coursePin}, "name coursePin ownerId");

    // check if the user is already enrolled in the course
    const memberList = await CourseMember.find({studentId: userId, courseId: course._id});
    const isEnrolled = memberList.length > 0;
    
    if (!isEnrolled) {
      // only enroll the student if they are not already enrolled!
      const registration = {
        studentId: userId,
        courseId: course._id,
        createdAt: new Date(),
        role: "student",
      };
      const newCourseMember = new CourseMember(registration);
      await newCourseMember.save();
    } 
    res.redirect("/showCourse/" + course._id);
  } catch (e) {
    next(e);
  }
});

/* 
*********************************************************************
Skill routes
********************************************************************* 
*/

app.get("/showSkills/:courseId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const skills = await Skill.find({courseId: courseId});
    const courseSkills = await CourseSkill.find({courseId: courseId}).populate('skillId');
    
    res.locals = {
      ...res.locals,
      courseId,skills,courseSkills
    };
    res.render("showSkills");
  } catch (e) {
    next(e);
  }
});

app.get("/addSkill/:courseId", authorize, isOwner, 
  (req, res) => {
    res.locals.courseId = req.params.courseId;
    res.render("addSkill");
});

/* when a user adds a skill to the course
   it is added to the skills collection and to the courseSkills collection
   skills can be shared by multiple courses, 
   but courseSkills are unique to a course
*/
app.post("/addSkill/:courseId",  authorize, isOwner, 
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      const newSkill = new Skill({
        name: req.body.name,
        description: req.body.description,
        shortName:req.body.shortName,
        level: req.body.level,
        createdAt: new Date(),
        courseId: courseId,
      });
      await newSkill.save();

      
      const courseSkill = new CourseSkill({
        courseId: courseId,
        skillId: newSkill._id,
        createdAt: new Date(),
      });
      await courseSkill.save();

      
      res.redirect("/showCourse/" + req.params.courseId);
    } catch (e) {
      next(e);
    }
});

// this removes a skill from the CourseSkill collection
// but does not remove the skill from the Skill collection
// as other course owners might be using the skill in other courses
app.get("/removeSkill/:courseId/:skillId", authorize, isOwner, 
  async (req, res, next) => {
    await CourseSkill.findOneAndDelete({courseId: req.params.courseId, skillId: req.params.skillId});
    res.redirect("/showSkills/"+req.params.courseId);
});

/*
  this route is used to show the details of a skill
  the user must be the owner of the course it was defined in
  to be able to edit the skill.
  TJH - we ought to allow users to edit their own skills...
*/
app.get("/showSkill/:courseId/:skillId", authorize, hasCourseAccess,
  async (req, res, next) => {

  try {
    const skillId = req.params.skillId;
    res.locals.skillId = skillId;
    const skill = await Skill.findOne({_id: skillId});
    res.locals.skill = skill;
    const courseId = res.locals.skill.courseId;
    res.locals.courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user.id;

    res.render("showSkill");
  } catch (e) {
    console.log("Error in showSkill: " + e);
    next(e);
  }
});

app.get("/editSkill/:courseId/:skillId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.skillId;
    res.locals.courseId = req.params.courseId;
    res.locals.skillId = id;
    res.locals.skill = await Skill.findOne({_id: id});
    res.locals.routeName = " editSkill";
    res.render("editSkill");
  } catch (e) {
    next(e);
  }
});


app.post("/editSkill/:courseId/:skillId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const skill = await Skill.findOne({_id: req.params.skillId});
    const courseId = req.params.courseId;
    skill.name = req.body.name;
    skill.shortName = req.body.shortName;
    skill.level = req.body.level;
    skill.description = req.body.description;
    skill.createdAt = new Date();

    await skill.save();

    res.redirect("/showSkill/" + req.params.courseId+"/"+ req.params.skillId);
  } catch (e) {
    next(e);
  }
}); 

app.get("/importSkills/:courseId", authorize, isOwner,
  async (req, res, next) => {
    res.locals.courseId = req.params.courseId;
    // find courses that the user has staff access to
    const taCourses = req.user.taFor || [];
    const ownedCourses = await Course.find({ownerId: req.user._id});
    const visibleCourses = taCourses.concat(ownedCourses.map((x) => x._id));

    res.locals.courses = await Course.find({_id:{$in:visibleCourses}}).sort({name: 1});

    res.locals.routeName = " importSkills";
    res.render("importSkills");
});

app.get("/showSkillsToImport/:courseId/:otherCourseId", authorize, isOwner,
  async (req, res, next) => {
    res.locals.courseId = req.params.courseId;
    res.locals.otherCourseId = req.params.otherCourseId;
    res.locals.otherCourse = await Course.findOne({_id: req.params.otherCourseId});

    res.locals.skills = await Skill.find({courseId: req.params.otherCourseId});
    res.locals.routeName = " showSkillsToImport";
    res.render('showSkillsToImport');
});

app.get('/importAllSkills/:courseId/:otherCourseId', authorize, isOwner,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const otherCourseId = req.params.otherCourseId;
      const skills = await Skill.find({courseId: otherCourseId});
      for (let skill of skills) {

        // create newSkill which is a copy of the skill
        // we will add the newSkill to our courseSkills collection
        // but when we search the library for problems
        // we will first find ids of all derived skills
        // and then search for problem with skills in that set of Ids.
        const newSkill = skill;
        newSkill.isNew = true;
        newSkill.courseId = courseId;
        newSkill.original = skill.original?skill.original._id:skill._id;  
        newSkill.createdAt = new Date();
        newSkill._id = undefined;
        await newSkill.save();

        let courseSkills = 
           await CourseSkill.find(
               {courseId: req.params.courseId, 
                skillId: newSkill._id});
        if (courseSkills.length == 0) {
          let courseSkill = new CourseSkill({
            courseId: req.params.courseId,
            skillId: newSkill._id,
            createdAt: new Date(),
          });
          await courseSkill.save();
        }

      }
      res.redirect("/showSkills/" + req.params.courseId);
    } catch (e) {
      next(e);
    }
});



/* 
*********************************************************************
ProblemSet routes
********************************************************************* 
*/


app.get("/addProblemSet/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  const id = req.params.courseId;

  const courseInfo = await Course.findOne({_id: id}, "name ownerId");
  res.locals.routeName = " addProblemSet";
  res.render("addProblemSet", {name: courseInfo.name, ownerId: courseInfo.ownerId, courseId: courseInfo._id});
});

app.post("/saveProblemSet/:courseId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    let newProblemSet = new ProblemSet({
      name: req.body.name,
      courseId: id,
      createdAt: new Date(),
      visible: true,
      pendingReviews: [],
    });

    await newProblemSet.save();

    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    res.redirect("/showCourse/" + res.locals.courseInfo._id);
  } catch (e) {
    next(e);
  }
});

app.get("/editProblemSet/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.locals.routeName = " editProblemSet";
  res.render("editProblemSet");
});

app.post("/updateProblemSet/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.psetId;
    const pset = await ProblemSet.findOne({_id: id});
    pset.name = req.body.name;
    pset.visible = req.body.visible == "visible";
    await pset.save();

    res.redirect("/showProblemSet/"+ pset.courseId+"/"+ id);
  } catch (e) {
    next(e);
  }
});

app.post("/uploadProblems/:courseId/:psetId",
  authorize, isOwner,
  memoryUpload.fields(
    [{name:"problems",maxCount:100},
     {name:"skill",maxCount:1},
    ]),
  async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    const courseId = req.params.courseId;

    const skillId = req.body.skill;
    // get the text of the probems uploaded from the server
    const problemStrings = req.files.problems.map(x=>x.buffer.toString());
    // create a list of Problem objects from the text of the problems
    // with the specified skill
    // and the name is the file name.
    let problemList = [];
    for (problem of req.files.problems) {
      let p = new Problem({
        courseId: courseId,
        psetId: psetId,
        description: problem.originalname,
        problemText: problem.buffer.toString(),
        mimeType: req.body.mimeType,
        answerMimeType: req.body.answerMimeType,
        rubric:"no rubric",
        pendingReviews:[],
        createdAt: new Date(),
        skills: [skillId],
        allowAnswers: false,
        submitable: false,
        answerable: false,
        peerReviewable: false,
        parentProblemId:null,
        variant:false,
      });
      problemList.push(p);
    }

    await Problem.insertMany(problemList);

    res.redirect("/showProblemSet/"+courseId+"/"+psetId);
  } catch (e) {
    next(e);
  }
});

const getStudentSkills = async (courseId,studentId) => {
  try {
    const skills = await Answer.find({courseId:courseId,studentId: studentId}).distinct("skills");
    return skills.map((c) => c.toString());
  } catch (e) {
    console.log("error in skills");
    console.dir(e);
    throw e;
  }
};


app.get("/uploadProblems/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;
  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId}).sort({description:1});
  res.locals.skills = await Skill.find({courseId: courseId});

  res.render("uploadProblems");
  }
);


app.get("/showProblemSet/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;
  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId}).sort({description:1});

  res.locals.courseInfo = await Course.findOne({_id: courseId}, "ownerId");
  res.locals.myAnswers = await Answer.find({psetId: psetId, studentId: userId});
  res.locals.pids = res.locals.myAnswers.map((x) => {
    if (!x.problemId) {
      res.json(res.locals.myAnswers);
      return;
      //console.log(`problemId is undefined for answer ${JSON.stringify(res.locals.myAnswers)}`);
    }
    x.problemId.toString(); 
  });
  //const allPsets = await ProblemSet.find({courseId: courseId});
  //res.locals.makeupSets = allPsets.filter((x) => x._id!=psetId).concat({name: "None", _id: null});  
  
  /*
  if the course is associated to a mathCourse,
  then we can use the mathCourse to get the exams
  of that course and pass them to the view
  as makeupSets
  */
  const course = await Course.findOne({_id: courseId});
  if (course.mathCourseId) {
    const mathCourse = await MathCourse({_id: course.mathCourseId});
    const exams = await MathExam.find({courseId: mathCourse._id});
    res.locals.makeupSets = exams.concat({name: "None", _id: null});
  }else {
    res.locals.makeupSets = [];
  }
  res.locals.skillsMastered = await getStudentSkills(courseId,req.user._id);

  res.locals.skills = await Skill.find({courseId: courseId});
  console.dir(JSON.stringify(res.locals.skills));
  
  res.render("showProblemSet");
});

app.post("/setAsMakeup/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    const courseId = req.params.courseId;
    const problemSet = await ProblemSet.findOne({_id:psetId});
    let makeupSet = req.body.makeupSet;
    console.log(`makeupSet="${JSON.stringify(makeupSet)}"`);
    if (makeupSet == "") {
      makeupSet = null;
    }
    problemSet.makeupOf = makeupSet;
    await problemSet.save();
    res.redirect("/showProblemSet/"+courseId+"/"+psetId);
  } catch (e) {
    next(e);
  }
});


app.get("/gradeProblemSet/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.courseId = req.params.courseId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  const problems = await Problem.find({psetId: psetId});

  res.locals.problems = problems;
  res.locals.answers = await Answer.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
  res.locals.students = memberList.map((x) => x.studentId);
  res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});
  const taList = await User.find({taFor: res.locals.courseInfo._id});
  const taIds = taList.map((x) => x._id);
  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});

  res.locals.taReviews = taReviews;
  let userIsOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

  if (userIsOwner || taIds.filter((x) => x.equals(req.user._id)).length > 0) {
    res.locals.routeName = " gradeProblemSet";
    res.render("gradeProblemSet");
  } else {
    res.send("You are not allowed to grade problem sets.");
  }
});


const preamble =
`

\\thispagestyle{empty}
 \\setcounter{page}{1}\\noindent Name: All Problems \\hfill Section: 0 \\hfill  Math 10a: Friday Assessment \\#1 -- Sep 3

\\input{title.tex}

`;

const personalizedPreamble = (studentName,courseName,examName) =>
`\\newpage
 \\thispagestyle{empty}
 \\setcounter{page}{1}\\noindent ${studentName}: \\hfill  ${courseName}  ${examName}
\\input{title.tex}
`
const generateTex = (problems) => {
  let tex = "\\begin{enumerate}\n";
  for (let p of problems) {
    tex += "\\item\n"
    if (p.mimeType=='plain'){
      tex += '\\begin{verbatim}\n'
    } else if (p.mimeType=='markdown'){
      tex += '\\begin{markdown}\n'
    }
    
    tex += p.description+"\n";
    

    tex += p.problemText + "\n";
    if (p.mimeType=='plain'){
      tex += '\\end{verbatim}\n'
    } else if (p.mimeType=='markdown'){
      tex += '\\end{markdown}\n'
    }

    tex += `
 \\vfill
{\\small Outcome F1:}

 
\\hfill Show all your work!

\\pagebreak
`;
     }
  tex += "\\end{enumerate}\n";
  return tex;
};

app.get("/downloadPersonalizedExamsAsTexFile/:courseId/:psetId", authorize, hasStaffAccess,
  /* this route will generate a large latex file with a personalized exam
     for the specified problemset in the specified course with one exam for
     each student in the course. Also each exam has questions only for those skills
     that that particular students has not yet mastered at this point in the course.

     Currently the latex file requires a few additional tex files:
     preamble.tex  - a latex file importing all necessary packages 
     title.tex - a file containing the first explanation page(s) for the exam,
        for example, the honesty pledge, the instructions, the grading policy, etc. 
        This needs to be customized for each class.   

  */
  async (req, res, next) => {
    const courseid = req.params.courseId;
    const psetId = req.params.psetId;
    //const problemSet = await ProblemSet.findOne({_id: psetId});
    const problems = await Problem.find({psetId: psetId});

    const courseMembers = await CourseMember.find({courseId: coursr}).populate('studentId');
    const studentIds = courseMembers.map((x) => x.studentId._id);
    const mastery = 
      await Answer.find({courseId: courseid, studentId: {$in: studentIds}});



    let skillDict = {};
    /* 
       skillMap(studentId) = [skillId1, skillId2, ...]
       shows the skills that the student has mastered.
    */
    for (let m of mastery) {
      let skills = m.skills;
      let studentId = m.studentId;
      let skillIds = skills.map((x) => x._id);
      let skillList = skillDict[studentId];
      skillList = skillList ? skillList.concat(skillIds) : skillIds;
      skillDict[studentId]= skillList;
    }



    /* create a dictionary problemDict indexed by skills which
       maps each skill to the list of problems containing that skill
       In practice each skill will correspond to exactly one problem,
       but we can make this code a little more general.
    */
   let problemDict = {};
   for (let p of problems){
    if (p.skills.length!=1){
      continue; // this shouldn't happen
    } else {
      problemDict[p.skills[0]] = p;
    }
   }

   let studentsWithFullMastery = [];
   let result = "";
    for (let s of courseMembers){
      /* generate a personalized exam for student s with only
         the problems for skills that s has not yet mastered,
         as determined by the skillList.
      */
     const studentId = s.studentId._id;
     
     const studentSkills = 
         skillDict[studentId]?skillDict[studentId].map((x)=> x+""): [];

     let testProblems = [];
     for (let p of problems){
      
      if (studentSkills.includes(p.skills[0]+"")) {
      } else {
        testProblems = testProblems.concat(p);
      }

     }
     

     const exam =  
        personalizedPreamble(s.studentId.googleemail,'Math10a','Fri 8/23/2024')
        + generateTex(testProblems);
     
     if (testProblems.length>0) {
        result += exam;
     } else {
        studentsWithFullMastery.push(s.studentId.googleemail);
     }
     
     

    }
    const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
    const endTex = '\\end{document}\n';
    res.setHeader('Content-type', 'text/plain');
    res.send(startTex+result+endTex);








  });


  /*
    This asynchronous function returns a dictionary: masteredSkills
    which maps each studentEmail to a list of skillIds that the student has mastered
  */
  const getSkillsMastered = async (mathCourseId) => {
    //console.log("in getClassMastery")
    const courseId = mathCourseId;
    const grades = await MathGrades.find({courseId:courseId});
    const sections = await MathSection.find({courseId:courseId,section:{$ne:""}});
    const enrolledStudents = sections.map(section => section.email);
    // console.log(`num enrolledStudents:${enrolledStudents.length}`);
    // console.log(`enrolledStudents:${JSON.stringify(enrolledStudents)}`);
    /*
      create a dictionary, skillMastery, which gives the set of students
      who have mastered each skill, indexed by skill name
    */
    const skillCounts = {};
    const skillMastery = {};  // list of students who have mastered each skill
    let studentCount = 0;
    let studentEmails = [];
    for (let grade of grades) {
      //console.log(`grade:${JSON.stringify(grade.email)}`);
      if (!enrolledStudents.includes(grade.email)) {
        //console.log('skipping');
        continue;
      }
      // count all students who have been graded for this course
      if (!studentEmails.includes(grade.email)) {
          studentEmails.push(grade.email);
          studentCount += 1;
        }
  
      for (let skill of grade.skillsMastered) {
        
        if (skillCounts[skill]) {
          if (!skillMastery[skill].includes(grade.email)) {
            skillMastery[skill].push(grade.email);
            skillCounts[skill] += 1;
          }
          
        } else {
          skillMastery[skill] = [grade.email];
          skillCounts[skill] = 1;
        }
      }
    } // end of for (let grade of grades) ....

    /*
    create a dictionary skillsMastered, indexed by student emails,
    containing a list of the skills that student has mastered.
    We create this from the skillMastery dictinonary: skills->[students]
    to get the "transpose"  students -> [skills]
    */
    const skillsMastered = {};
    for (let skill in skillMastery) {
      for (let student of skillMastery[skill]) {
        if (skillsMastered[student]) {
          skillsMastered[student].push(skill);
        } else {
          skillsMastered[student] = [skill];
        }
      }
    }



    /*
    these skills are just the names of the skills F1, F2, ..., G1, G2, ...
    We need to return instead a list of skillIds. First though we
    create a dictionary from skill names to skillIds
    */
    
    return {skillsMastered,skillCounts,enrolledStudents};

  
  
 
  }


  app.get("/downloadPersonalizedExamsAsTexFileMGA/:courseId/:psetId", authorize, hasStaffAccess,
    /* this route will generate a large latex file with a personalized exam
       for the specified problemset in the specified course with one exam for
       each student in the course. Also each exam has questions only for those skills
       that that particular students has not yet mastered at this point in the course.
  
       The list of mastered skills is obtained from the MGA database!

       Currently the latex file requires a few additional tex files:
       preamble.tex  - a latex file importing all necessary packages 
       title.tex - a file containing the first explanation page(s) for the exam,
          for example, the honesty pledge, the instructions, the grading policy, etc. 
          This needs to be customized for each class. 
       
       If this problem set is a makeup, then we only include students who have not
       taken the specified exam for which this is a makeup. 
  
    */
    async (req, res, next) => {
      const courseId = req.params.courseId;
      const course = await Course.findOne({_id: courseId});
      if (!course.mathCourseId) {
        res.send("This course does not have an associated math course.");
      } else {

        /*
        First we calculate the set of skills that each student has mastered
        and some other things we don't need yet!
        */
        const mathCourseId = course.mathCourseId;
        const {skillsMastered,skillCounts,enrolledStudents} 
           = await getSkillsMastered(mathCourseId);
        

        /*
        Now we create a dictionary skillIdsMastered: studentEmail -> [skillId]
        which maps each student to a list of skillIds that the student has mastered
        We will use this to create the personalized exams.
        */
        let allSkills = await Skill.find({courseId:courseId});
        // for (let skill of allSkills) {
        //   console.dir([skill._id+"",skill.name]);
        //   console.log(JSON.stringify(skill));
        // }
        let skillIdMap = {}
        for (let skillName in skillCounts) {
          let skill = await Skill.findOne({courseId:courseId,shortName: skillName});
          if (skill) skillIdMap[skillName] = skill._id+"";
        }

        let skillIdsMastered = {}
        for (let student in skillsMastered) {
          skillIdsMastered[student] 
            = skillsMastered[student].map((x) => skillIdMap[x]);
        }

        /*
        Next we get the problems for this problem set
        */
        const psetId = req.params.psetId;
        const pset = await ProblemSet.findOne({_id: psetId});
        const problems = await Problem.find({psetId: psetId});
    

    
        /* Next, we create a dictionary problemDict indexed by skills which
           maps each skill to the list of problems containing that skill
           In practice each skill will correspond to exactly one problem,
           but we can make this code a little more general.
        */
       let problemDict = {};
       for (let p of problems){
        if (p.skills.length!=1){
          continue; // this shouldn't happen
        } else {
          problemDict[p.skills[0]] = p;
        }
       }
    
       /*
       This exam might be a makeup of another exam. If so, we need to
       find the students who have already taken the original exam
       and not include them in the makeup exam.
       So studentsWhoCanTakeExam is initially all enrolled students,
       but if this is a makeup exam, then it will be the students
       who skipped the original exam.
       */

       let studentsWhoCanTakeExam = enrolledStudents;
       let tookExamEmails=[];
       if (pset.makeupOf) { 
         const makeupOf = pset.makeupOf; // the id of the MathExam that this exam is a makeup for
         tookExamEmails
             = (await MathGrades
                      .find({examId: makeupOf}))
                      .map((x) => x.email);
         studentsWhoCanTakeExam 
            = enrolledStudents.filter(x => !(tookExamEmails.includes(x)));
        }
      
        /*
        Now we process the list of students who can take the exam
        and generate a personalized exam for each student
        but we don't generate exams for students who have mastered
        all of the skills, we put them into a list studentsWithFullMastery
        */
       let studentsWithFullMastery = [];
       let result = "";
        for (let studentEmail of studentsWhoCanTakeExam){
          /* generate a personalized exam for student s with only
             the problems for skills that s has not yet mastered,
             as determined by the skillList.
          */
         
         let studentSkills = 
             skillIdsMastered[studentEmail];
         if (!studentSkills) {
           studentSkills = [];
         }
    
         let testProblems = [];
         for (let p of problems){
          if (studentSkills.includes(p.skills[0]+"")) {
            // skip the problem if they have mastered it
          } else {
            testProblems = testProblems.concat(p);
          }
        }
      
  
       const exam =  
          personalizedPreamble(studentEmail,'CourseName','ExamDate')
          + generateTex(testProblems);
       
       if (testProblems.length>0) {
          result += exam;
       } else {
          studentsWithFullMastery.push(studentEmail);
       }
      
       
  
        }
        const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
        const endTex = '\\end{document}\n';
        const fullMasteryReport = `
        \\newpage
        \\section{Students with Full Mastery}
        \\begin{itemize}
        `
        + studentsWithFullMastery.map((x) => `\\item ${x}`).join("\n") 
        + "\\end{itemize}\n\newpage";

        res.setHeader('Content-type', 'text/plain');
        res.send(startTex+result+fullMasteryReport + endTex);
      }
    });

app.get('/downloadAsTexFile/:courseId/:psetId', authorize, hasStaffAccess,
  async (req, res, next) => {
    const psetId = req.params.psetId;
    const problemSet = await ProblemSet.findOne({_id: psetId});
    //const problems = await Problem.find({psetId: psetId});
    let problems = await Problem.find({psetId: psetId});  
    //res.setHeader('Content-disposition', 'attachment; filename=problems.tex');
    res.setHeader('Content-type', 'text/plain');
    const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
    const endTex = '\\end{document}\n';

    res.send(startTex+generateTex(problems)+endTex);
    //res.send('downloadAsTexFile not implemented yet');
  });

app.get("/addProblem/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const pset = await ProblemSet.findOne({_id: req.params.psetId});
    res.locals.psetId = req.params.psetId;
    res.locals.courseId = req.params.courseId;
    res.locals.skills = await Skill.find({courseId: pset.courseId});
    res.locals.routeName = " addProblem";
    res.locals.problem={description:"",problemText:"",points:0,rubric:"",skills:[],visible:true,submitable:true,answerable:true,peerReviewable:true};
    res.render("addProblem");
  } catch (e) {
    next(e);
  }
});

app.post("/saveProblem/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;

    // generate the list of skills from a checkbox widget
    let skills = req.body.skills;
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }

    let newProblem = new Problem({
      courseId: courseId,
      psetId: psetId,
      description: req.body.description,
      problemText: req.body.problemText,
      mimeType: req.body.mimeType,
      answerMimeType: req.body.answerMimeType,
      rubric: req.body.rubric,
      skills: skills,
      pendingReviews: [],
      allowAnswers: true,
      visible: req.body.visible == "visible",
      submitable: req.body.submitable == "submitable",
      answerable: req.body.answerable == "answerable",
      peerReviewable: req.body.peerReviewable == "peerReviewable",
      parentProblemId: null,
      variant: false,
      createdAt: new Date(),
    });

    await newProblem.save();

    res.redirect("/showProblemSet/" +courseId+"/"+ psetId);
  } catch (e) {
    next(e);
  }
});

app.post("/updateProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const problem = await Problem.findOne({_id: req.params.probId});
    const courseId = problem.courseId;
    problem.description = req.body.description;
    problem.problemText = req.body.problemText;
    problem.mimeType = req.body.mimeType;
    problem.answerMimeType = req.body.answerMimeType;
    problem.rubric = req.body.rubric;
    problem.createdAt = new Date();

    problem.visible = req.body.visible == "visible";
    problem.answerable = req.body.answerable == "answerable";
    problem.submitable = req.body.submitable == "submitable";
    problem.peerReviewable = req.body.peerReviewable == "peerReviewable";

   
    let skills = req.body.skill;
  
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }
    problem.skills = skills;

    await problem.save();

    res.redirect("/showProblem/" +courseId+"/"+problem.psetId+"/"+ req.params.probId);
  } catch (e) {
    next(e);
  }
});

app.get("/showProblem/:courseId/:psetId/:probId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const probId = req.params.probId;
    const userId = req.user._id;
    
    const problem = await Problem.findOne({_id: probId});
    const course = await Course.findOne({_id: courseId}, "ownerId");

    // get info about answers
      
    const allAnswers = await Answer.find({problemId: probId});
    const answerCount = allAnswers.length; 
    const usersAnswers = 
      await Answer
              .find({psetId:psetId,problemId: probId, studentId: userId})
              .sort({createdAt:-1});
    const theAnswer = (usersAnswers.length==0)?{answer:""}:usersAnswers[0];
    
    const reviews = await Review.find({psetId:psetId, problemId: probId});
    const reviewCount = reviews.length;
    const averageReview = reviews.reduce((t, x) => t + x.points, 0) / reviews.length;
    

    const skills = await Skill.find({_id: {$in: problem.skills}});
    const skillsMastered = await getStudentSkills(courseId,userId);
    
    let markdownText = problem.problemText;
    if (problem.mimeType == 'markdown') {
      markdownText = converter.makeHtml(markdownText);
      const mathjaxScript = `
<script type="text/x-mathjax-config">
  MathJax.Hub.Config({
    tex2jax: {
      inlineMath: [ ['$','$'], ["\\(","\\)"] ],
      processEscapes: true
    },
  });
</script>
<script type="text/javascript"
  src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
</script>

`;
      markdownText = mathjaxScript + markdownText;

    }


    let status = ""
    if (!problem.visible) {
      status = 'hidden';
    } else if (!problem.answerable) {
      status = 'closed';
    } else if (!problem.submitable) {
      status = 'open';
    } else {
      status = 'submitable';
    }
    res.locals = 
       {...res.locals, 
        status,courseId,psetId,probId,
        problem,course,
        markdownText,
        answerCount,allAnswers,usersAnswers,theAnswer,
        skills,skillsMastered,
        reviews, reviewCount, averageReview,
        };


    if (false){
      res.json(res.locals);
    }
    else if ((status == 'hidden') && !isStaff) {
      res.send('this problem has been hidden by the owner');
    } else {
      res.render("showProblem");
    }
    
  } catch (e) {
    console.log("Error in showProblem: " + e);
    next(e);
  }
});

app.get("/startProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: true});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+ req.params.probId);
});

app.get("/stopProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: false});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+req.params.probId);
});




app.get('/showProblemLibrary/:courseId/:psetId', authorize, hasCourseAccess,
  async (req,res,next) => {
    res.locals.routeName=" showProblemLibrary";
    res.locals.courseId = req.params.courseId;
    res.locals.psetId = req.params.psetId;
    res.locals.problems = [];
    let skills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    res.locals.skills = skills.map((x) => x.skillId);
    res.locals.skill = null;
    res.locals.newProblems=[];
    //res.json(res.locals.skills);
    res.render('showProblemLibrary');
  }
)


app.get('/showProblemsBySkill/:courseId/:psetId/:skillId', authorize, hasCourseAccess,
  async (req,res,next) => {
    /*
      We want to find the list of problems using the specified skill,
      sorted by the last time they were used in any course.
      We also only want original problems not, copies of problems,
      but we want the last time any copy was used in any course.
      We also want the problems whose skill is a variant of the specified skill.
      We keep track of the original skill for each skill that gets duplicated
      in a course, so we can find the list of variants of a skill
      and look for problems with any of those skills.
      So we need to compute a psetMap which maps problemIds to the
      list of dates that copies of that problem were used in a course
      and sort the problems by the first (latest) date in that list.
      Eventually, we will narrow this search to the problems
      used in a set of courses, or in an organization...
    */
    const routeName=" showProblem";
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const skillId = req.params.skillId;

    // get the skill object we are interested in
    const skill = await Skill.findOne({_id:  skillId});
    // get the skill variants, i.e. skills with the same original skill
    let variants = [];
    if (skill.original) {
      variants = await Skill.find({original: skill.original});
      variants.push(skill.original._id);
    }else {
      variants = await Skill.find({original: skill._id});
      variants.push(skill._id);
    }
    const variantIds = variants.map((x) => x._id);
    console.log(`variantIds: ${JSON.stringify(variantIds)}`);


    const taCourses = req.user.taFor || [];
    const ownedCourses = await Course.find({ownerId: req.user._id});
    const visibleCourses = taCourses.concat(ownedCourses.map((x) => x._id));

    // get the problems that have that skill in their list of skills
    // and for which the user is the owner or is a TA
    // and populate the courseId field
    // we use $elemMatch to find problems whose skills list
    // contains any of the variant skills
    const problems =
        await Problem
              .find(
                {skills: {$elemMatch:{$in:variantIds}},
                 courseId: {$in: visibleCourses}
                })
              .populate('courseId')
              .sort({createdAt: -1});

    console.log(`num problems is ${problems.length}`);
    
    
    // get the list of skills for this course
    let courseSkillObjects = 
      await CourseSkill
            .find({courseId: courseId})
            .populate('skillId');
    const skills = courseSkillObjects.map((x) => x.skillId);



     /*
      psetMap is a dictionary mapping problemIds to lists of dates
      which are the dates the problem or a variant was created in any course.
      for any problemId, the list of dates is sorted in descending order.
      If the problem is a variant, the date is the date the variant was created
      and it is indexed by the parentProblemId field.
    */
    let psetMap = {};
    for (let p of  problems) {
      const originalId = p.parentProblemId || p._id;
      psetMap[originalId] = psetMap[originalId] || [];
      psetMap[originalId].push(p.createdAt);
    }

    // sort the psetMap dates in descending order
    const compDates = (a,b) => {if (a<b){return 1;} else {return -1}};

    for (let p in  psetMap) {
      psetMap[p].sort(compDates);
    }

    const compProbs = (a,b) => {
      let d1 = psetMap[a._id][0];
      let d2 = psetMap[b._id][0];
      if (d1>d2){
        return 1;
      }else{
        return -1;
      };
    }
  
    const newProblems = 
      problems.filter((x) => x.parentProblemId==null);

    newProblems.sort(compProbs);


    res.locals = 
      {...res.locals, 
        routeName, 
        courseId, psetId, skillId, 
        problems, newProblems, 
        psetMap,
        skill, skills};

    res.render('showProblemLibrary');
  }
)


/*
  This route is used to add a problem to a problem set from the library
  of problems that contain a specified skill. Even though problems can
  contain multiple skills, we are only looking for problems that contain
  a single skill (or a variant) and the new problem will just have that new skill
*/
app.get("/addProblemToPset/:courseId/:psetId/:probId/:skillId", authorize, isOwner,
  async (req, res, next) => {
    const courseId = req.params.courseId;
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    const skillId = req.params.skillId;

    // create a copy of the problem object
    const problem = await Problem.findOne({_id:probId}); 
    const newProblem = problem;
    newProblem.isNew = true;
    newProblem.courseId = courseId;
    newProblem.psetId = psetId;
    newProblem.parentProblemId = problem._id;  
    newProblem.createdAt = new Date();
    newProblem.skills = [skillId];
    newProblem._id = undefined;
    await newProblem.save();


    res.redirect("/showProblemSet/" + courseId+"/"+ psetId); 
  });

app.get("/removeProblem/:courseId/:psetId/:probId", authorize, isOwner,
  // we don't need to pass the psetId to this route, but it is useful for debugging
  async (req, res, next) => {
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    console.log("removing problem: " + probId +" from pset: " + psetId);

    const deletedCourse = await Problem.deleteOne({_id: probId});
    console.log("deleted course: " + JSON.stringify(deletedCourse,null,2));
    res.redirect("/showProblemSet/" + req.params.courseId+"/"+ psetId);
  });



function getElementBy_id(id, vals) {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]["_id"] + "" == id) {
      return vals[i];
    }
  }
  return null;
}

app.get("/showAllAnswers/:courseId/:probId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const userId = req.user._id;
    const courseId = req.params.courseId;
    const probId = req.params.probId;

    const problem = await Problem.findOne({_id: probId});
    const psetId = problem.psetId;

    const course = await Course.findOne({_id: courseId});


    const userReviews = await Review.find({problemId: probId, reviewerId: userId});
    const allSkills = await Skill.find({courseId: courseId});

    const getSkill = (id, vals) => getElementBy_id(probId, vals);
    const numReviews = userReviews.length;
    const canView = numReviews >= 2 || isOwner;
    let answers = []
    let reviews = []
    if (canView) {
      answers = await Answer.find({problemId: probId}).collation({locale: "en", strength: 2}).sort({answer: 1});
      reviews = await Review.find({problemId: probId});
    }
    const isTA = req.user.taFor && req.user.taFor.includes(course._id);
    let taList = await User.find({taFor: courseId});
    taList = taList.map((x) => x._id);
    const routeName = " showAllAnswers";
    res.locals = {
      ...res.locals,
      courseId,probId,psetId, 
      problem,course,
      allSkills,getSkill,
      numReviews,canView,answers,reviews,isTA,taList,routeName
    }
    //res.json(res.locals);
    res.render("showAllAnswers");
  } catch (e) {
    next(e);
  }
});

app.get("/editProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const id = req.params.probId;
  res.locals.probId = id;
  res.locals.problem = await Problem.findOne({_id: id});
  res.locals.course = await Course.findOne({_id: res.locals.problem.courseId}, "ownerId");
  res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
  res.locals.allSkills = await Skill.find({courseId: res.locals.problem.courseId});
  res.locals.routeName = " editProblem";
  res.render("editProblem");
});

/*
  This route has some nuanced behavior.
  If the user tries to save an answer that has already
  been reviewed, then we should not let them do it and
  we should send them to a page that says their answer has
  been reviewed and they can't update it. 
*/
app.post("/saveAnswer/:courseId/:psetId/:probId", 
          authorize, 
          hasCourseAccess,
  async (req, res, next) => {
    try{
      const probId = req.params.probId;
      const psetId = req.params.psetId;
      const courseId = req.params.courseId;

      const answers = await Answer.find({studentId: req.user._id, problemId: probId});

      const answerIds = answers.map((x) => x._id);
      const reviews = await Review.find({answerId: {$in: answerIds}});

      if (reviews.length > 0) {
        res.redirect("/showReviewsOfAnswer/" + courseId +"/" + psetId+"/"+ answerIds[0]);
      } else {
        let newAnswer = new Answer({
          studentId: req.user._id,
          courseId: courseId,
          psetId: psetId,
          problemId: probId,
          answer: req.body.answer,
          reviewers: [],
          numReviews: 0,
          pendingReviewers: [],
          createdAt: new Date(),
        });

        // we need to delete any previous answers for this problem
        // each problem should have at most one answer per student
        await Answer.deleteMany({studentId: req.user._id, problemId: probId});

        await newAnswer.save();

        res.redirect("/showProblem/" +courseId+"/" + psetId+"/"+probId);

    }
  } catch (e) {
      next(e);
    }
  });


const addImageFilePath = (req,res,next) => {
  // this adds a filepath to the request object
  // and is used to upload images in the storage system
  // we append a random number so that a bad actor
  // couldn't find a students answer by getting their
  // user_id and the course,pset, and problem Ids
  // this is a kind of salt.. 
  console.log('in addImageFilePath');
  const uniqueSuffix = //Date.now() + '_' + 
      Math.round(Math.random() * 1E9);
      console.log('...');
      console.dir(process.env);
      if (process.env.UPLOAD_TO=='AWS'){
        console.log(`bucketname: "${process.env.AWS_BUCKET_NAME}"`);
        req.filepath =
          req.params.probId+"_"
          +req.user._id+"_"
          +uniqueSuffix+"_";
        req.urlpath = 
          "https://" + 
          process.env.AWS_BUCKET_NAME +
          ".s3.us-east-2.amazonaws.com/"+
          req.filepath;
      } else {
        req.filepath=
          "/answerImages/" +
          req.params.probId+"_"
          +req.user._id+"_"
          +uniqueSuffix+"_";
        req.urlpath = req.filepath;
      }
      console.log(`filepath: ${req.filepath}`);
      console.log(`urlpath: ${req.urlpath}`);
      next();
};

app.post("/uploadAnswerPhoto/:courseId/:psetId/:probId", 
          authorize, hasCourseAccess,
          addImageFilePath,
          upload.single('picture'),
    async (req, res, next) => {
      try {
        console.log("in uploadAnswerPhoto");
        const probId = req.params.probId;
        const psetId = req.params.psetId;
        const courseId = req.params.courseId;
  
        const answers = await Answer.find({studentId: req.user._id, problemId: probId});
  
        const answerIds = answers.map((x) => x._id);
        const reviews = await Review.find({answerId: {$in: answerIds}});
  
        if (reviews.length > 0) {
          res.redirect("/showReviewsOfAnswer/" + courseId +"/" + psetId+"/"+ answerIds[0]);
        } else {

          // before uploading a new answer
          // first look for an old answer 
          // and delete the image file if it exists
          // if the imageFilePath starts with https://
          // then we have to delete it from AWS S3
          // otherwise we delete it from the local filesystem
          if ( answers.length > 0) {
            console.log(`deleting old answer: ${answers[0]._id}`);
            //if (process.env.UPLOAD_TO=='AWS'){
            if (process.env.UPLOAD_TO=='AWS'){
              console.log(`deleting AWS file: ${answers[0].imageFilePath}`);
              try {
                let imageFilePath = answers[0].imageFilePath;
                console.log(`deleting file: ${imageFilePath}`); 
                if (imageFilePath) {
                  let key = imageFilePath.split('/').slice(-1)[0];
                  console.log(`deleting file with key: ${key}`);
                  await s3.deleteObject({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key
                  }).promise();
                 }
              } catch(e){
                console.log('error deleting AWS file: ' + e);
              }
            } else {
              console.log(`deleting local file: ${answers[0].imageFilePath}`);
              try {
                  let imageFilePath = 
                    __dirname+"/public/"+answers[0].imageFilePath;
                  console.log(`deleting file: ${imageFilePath}`);
                  console.log(`answers[0].imageFilePath: ${answers[0].imageFilePath}`);
                  if (imageFilePath) {
                    try {
                      await unlinkAsync(imageFilePath);
                    } catch (e){
                      console.log('error ulinking file: ' + e);
                    }
                  }
                } catch (e) {
                  console.log('error deleting LOCAL file: ' + e);
                }
            }
          }
          console.log('creating a new answer');
          // now create a new answer with the new photo
          // and store in the database
          let newAnswerJSON = {
            studentId: req.user._id,
            courseId: courseId,
            psetId: psetId,
            problemId: probId,
            imageFilePath: req.urlpath+req.suffix,
            reviewers: [],
            numReviews: 0,
            pendingReviewers: [],
            createdAt: new Date(),
          };
          console.dir(newAnswerJSON);
          let newAnswer = new Answer(newAnswerJSON);
  
          // we need to delete any previous answers for this problem
          // each problem should have at most one answer per student
          await Answer.deleteMany({studentId: req.user._id, problemId: probId});
  
          await newAnswer.save();
  
          res.redirect("/showProblem/" +courseId+"/" + psetId+"/"+probId);
        }
      
      } catch (e) {
        console.log("error in uploadAnswerPhoto: " + e);
        next(e);
      }

    }

);
  





app.post("/requestRegrade/:courseId/:reviewId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const review = await Review.findOne({_id: reviewId});
    const regradeRequest = new RegradeRequest({
      reviewId: reviewId,
      answerId: review.answerId,
      problemId: review.problemId,
      psetId: review.psetId,
      courseId: review.courseId,
      studentId: review.studentId,
      reason: req.body.reason,
      reply: "none yet",
      completed: false,
      createdAt: new Date(),
    });
    await regradeRequest.save();

    res.redirect("/showRegradeRequests/" + review.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequests/:courseId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const regradeRequests = await RegradeRequest.find({courseId: req.params.courseId});
    res.locals.regradeRequests = regradeRequests;
    res.locals.courseId = req.params.courseId;
    res.locals.routeName = " showRegradeRequests";
    res.render("showRegradeRequests");
    //res.json([req.params.courseId,regradeRequests])
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequest/:courseId/:requestId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const requestId = req.params.requestId;
    const regradeRequest = await RegradeRequest.findOne({_id: requestId});

    res.locals.regradeRequest = regradeRequest;
    res.redirect("/showReviewsOfAnswer" 
              +"/"+regradeRequest.courseId 
              +"/"+regradeRequest.psetId
              +"/"+regradeRequest.answerId);
    //res.json([req.params.requestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

app.post("/updateRegradeRequest/:courseId/:regradeRequestId", authorize, hasStaffAccess, 
  async (req, res, next) => {
  try {
    let regradeRequest = await RegradeRequest.findOne({_id: req.params.regradeRequestId});
    regradeRequest.reply = req.body.reply;
    regradeRequest.completed = true;
    await regradeRequest.save();
    res.redirect("/showReviewsOfAnswer"
      +"/"+regradeRequest.courseId 
              +"/"+regradeRequest.psetId
              +"/"+regradeRequest.answerId);
    //res.json([req.params.regradeRequestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});



app.get("/thumbsU/:courseId/:mode/:reviewId/:userId", authorize, hasCourseAccess,
  async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {upvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {upvoters: userId}});
  }

  res.json({result: "OK"});
});

app.get("/thumbsD/:courseId/:mode/:reviewId/:userId", authorize, hasCourseAccess,
  async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {downvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {downvoters: userId}});
  }

  res.json({result: "OK"});
});


app.get("/showStudentInfo/:courseId", authorize, hasStaffAccess,
  (req, res) => {
  res.redirect("/showTheStudentInfo/" + req.params.courseId+"/summary");
});

app.get("/showTheStudentInfo/:courseId/:option", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    // get the courseInfo
    res.locals.courseInfo = await Course.findOne({_id: id}, "name ownerId");

    const isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!(isOwner || isTA)) {
      
      res.send("only the course owner and TAs can see this page");
      return;
    }

    // get the list of ids of students in the course
    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    res.locals.students = memberList.map((x) => x.studentId);

    // student status is a map from id to status
    // we can use this to filter student based on their statue
    // e.g. enrolled, dropped, ta, guest, owner, ...
    // we will need a page to see all students and edit their statuses
    res.locals.studentStatus = new Map();
    memberList.map((x) => {
      res.locals.studentStatus.set(x.studentId, x.status);
    });

    res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

    const courseId = res.locals.courseInfo._id;
    res.locals.answers = await Answer.find({courseId: courseId});

    res.locals.problems = await Problem.find({courseId: courseId});

    res.locals.reviews = await Review.find({courseId: courseId});

    const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

    res.locals.gradeSheet = gradeSheet;

    res.locals.routeName = " showTheStudentInfo";

    if (req.params.option == "csv") {
      res.render("showStudentInfoCSV");
    } else {
      res.render("showStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/showOneStudentInfo/:courseId/:studentId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.params.studentId;
    const courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    const studentInfo = await User.findOne({_id: studentId});
    res.locals.courseInfo = courseInfo;
    res.locals.studentInfo = studentInfo;

    const isTheStudent = req.user._id.equals(studentId);

    if (!res.locals.isOwner && !res.locals.isTA && !isTheStudent) {
      res.send("only the course owner and TAs and the student themselves can see this page");
    } else {

      // get the list of ids of students in the course
      const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
      res.locals.students = memberList.map((x) => x.studentId);

      res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

      res.locals.answers = 
        await Answer.find({courseId: courseId})
              .populate('skills');

      let problems = await Problem.find({courseId: courseId});
      res.locals.problems = problems;

      // res.locals.problems = 
      //    await Problem.find({courseId: courseId})
      //         .populate('skills');

      res.locals.reviews = await Review.find({courseId: courseId});

      const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

      res.locals.gradeSheet = gradeSheet;
      res.locals.routeName = " showOneStudentInfo";
      //res.json(res.locals);
      res.render("showOneStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.post("/addTA/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  try {
    let ta = await User.findOne({googleemail: req.body.email});
    if (ta) {
      ta.taFor = ta.taFor || [];
      ta.taFor.push(req.params.courseId);
      ta.markModified("taFor");

      await ta.save();
    }
    // add the TA to the CourseMember collection with role TA
    let courseMember = new CourseMember({
      courseId: req.params.courseId,
      studentId: ta._id,
      role: "ta",
      createdAt: new Date(),
    });
    await courseMember.save();

    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.post("/removeTAs/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  try {

    if (req.body.ta == null) {
      // do nothing
    } else if (typeof req.body.ta == "string") {
      await User.update({_id: req.body.ta}, {$set: {taFor: []}});
      await CourseMember.deleteOne({courseId: req.params.courseId, studentId: req.body.ta});
    } else {
      req.body.ta.forEach(async (x) => {
        await User.update({_id: x}, {$set: {taFor: []}});
        await CourseMember.deleteOne({courseId: req.params.courseId, studentId: x});
      });
    }

    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showTAs/:courseId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId coursePin");
    const taMembers 
      = await CourseMember
              .find({courseId: req.params.courseId,role:'ta'})
    const taIds = taMembers.map((x) => x.studentId);
    res.locals.tas = await User.find({_id:taIds});

    res.render("showTAs");
  } catch (e) {
    next(e);
  }
});


const ObjectId = mongoose.Types.ObjectId;

const masteryAgg = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $addToSet: {
          $arrayElemAt: ["$skills", 0],
        },
      },
    },
  },
];

app.get("/mastery/:courseId", authorize, hasStaffAccess,
  async (req, res, next) => {
  const agg = masteryAgg(req.params.courseId);
  const zz = await Answer.aggregate(agg);
  res.json(zz);
});

const masteryAgg2 = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $push: "$skills",
      },
    },
  },
];

const skillCount = (skills, skillLists) => {
  skillmap = {};
  for (skill of skills) {
    skillmap[skill] = 0;
  }
  for (skillList of skillLists) {
    for (skill of skillList) {
      skillmap[skill] += 1;
    }
  }
  return skillmap;
};

/*
    This route will analyze the skill mastery for the entire class.
    The main goal is to generate a table which shows for each student
    and for each skill, the number of times that students has demonstrated
    mastery of that skill. We will put the skills in an array and label the
    skill columns with numbers (perhaps with tooltips to see the full name).
  */
app.get("/mastery2/:courseId", authorize, isOwner,
  async (req, res, next) => {
  const courseId = req.params.courseId;
  const agg = masteryAgg2(courseId);
  const mastery = await Answer.aggregate(agg);
  const studentIds = mastery.map((x) => x._id);
  const students = await User.find({_id: {$in: studentIds}});
  const skills = await Skill.find({courseId});
  const skillIds = skills.map((x) => x._id);
  const studentSkillCounts = {};
  for (student of mastery) {
    studentSkillCounts[student["_id"]] = skillCount(skillIds, student["skills"]);
  }
  const studentmap = {};
  for (student of students) {
    studentmap[student.id] = student;
  }

  let skillmap = {}; // this maps the skill id to the skill
  for (skill of skills) {
    skillmap[skill.id] = skill;
  }
  let sum = (vals) => {
    total = 0;
    for (val of vals) {
      total += val;
    }
    return total;
  };

  let sum2 = (vals) => {
    total = 0;
    for (val of vals) {
      total += val > 0 ? 1 : 0;
    }
    return total;
  };

  let data = [];
  for (student in studentSkillCounts) {
    let a = {};
    a["student"] = studentmap[student];
    a["skillCounts"] = studentSkillCounts[student];
    a["total"] = sum2(Object.values(a["skillCounts"]));
    data.push(a);
  }
  data = data.sort((x, y) => (x["total"] < y["total"] ? 1 : -1));
  res.locals.routeName = " summarizeSkills";

  res.render("summarizeSkills", {courseId, data, mastery, studentIds, students, studentmap, studentSkillCounts, skillIds, skillmap, skills});

  //res.json({data,mastery,studentIds,students,studentSkillCounts,skillIds,skillmap,skills})
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.locals.routeName = " error";
  res.locals.user= req.user||{}
  res.render("error");
});

function createGradeSheet(students, problems, answers, reviews) {
  let gradeSheet = {};
  let problemList = {};
  let answerList = {};
  for (let s in students) {
    let student = students[s];
    gradeSheet[student._id] = {student: student, answers: {}};
  }
  for (let p in problems) {
    let problem = problems[p];
    problemList[problem._id] = problem;
  }
  for (let a in answers) {
    let answer = answers[a];
    try {
      answerList[answer._id] = answer;
     
      // it is possible that a TA will not be a student
      // so we need to create a
      gradeSheet[answer.studentId] = gradeSheet[answer.studentId] || {status: "non-student", student: "non-student", answers: {}};
      gradeSheet[answer.studentId]["answers"][answer._id] = {answer: answer, reviews: []};
    } catch (error) {
      console.log("Error in createGradeSheet: " + error.message + " " + error);
      console.log(error);
    }
  }

  for (let r in reviews) {
    let review = reviews[r];
    try {
      // the problem is that review.answerId might correspond to an answer
      // that I deleted!  but there is another duplicate with the same
      // review.studentId and same review.problemId, so I may need to redesign.
      // I could create an updateReviews route that would update all
      // review.answerIds based on the studentId and problemId
      let z = gradeSheet[answerList[review.answerId].studentId]["answers"][review.answerId];
      //z['reviews'] = z['reviews']||[]
      z["reviews"].push(review);
    } catch (error) {
      console.log("Error in createGradeSheet-2s: " + error.message + " " + error);
      console.log("error.lineNumber = " + error.linenNumber);
      console.log("stack: " + error.stack);
    } 
  }

  return {grades: gradeSheet, problems: problemList, answers: answerList};
}



      
module.exports = app;
