// Start/restart this with
// pm2 start bin/www -n mastery -i 3
// restart with
// pm2 restart mastery
// get help with
// pm2

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
require("dotenv").config();

if (process.env.IS_ON_WEB == "False") {
  var livereload = require("livereload");
  var connectLiveReload = require("connect-livereload");
  // require the socket.io module
}

// Routes
const reviews = require('./routes/reviews');
const auth = require('./routes/authRouter');
const similarity = require('./routes/similarity');
const mathgrades = require('./routes/mathgrades');


// Models!
const Course = require("./models/Course");
const CourseSkill = require("./models/CourseSkill");
const ProblemSet = require("./models/ProblemSet");
const Problem = require("./models/Problem");
const ProblemCatalogCard = require("./models/ProblemCatalogCard");
const PsetProblem = require("./models/PsetProblem");
const Answer = require("./models/Answer");
const Review = require("./models/Review");
const User = require("./models/User");
const CourseMember = require("./models/CourseMember");
const Skill = require("./models/Skill");
const RegradeRequest = require("./models/RegradeRequest");
const ejsLint = require("ejs-lint");

if (process.env.IS_ON_WEB == "False") {
  const liveReloadServer = livereload.createServer();
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
}

//const mongoose = require( 'mongoose' );
//const ObjectId = mongoose.Schema.Types.ObjectId;

//var apikey = require('./config/apikey');

// AUTHENTICATION MODULES
(session = require("express-session")), (bodyParser = require("body-parser")), (flash = require("connect-flash"));

const MongoStore = require("connect-mongo")(session);

// END OF AUTHENTICATION MODULES

const mongoose = require("mongoose"); 


//mongoose.connect("mongodb+srv://" + process.env.MONGO_USER + ":" + process.env.MONGO_PW + "@cluster0.f3f06uz.mongodb.net/test", {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
//mongoose.connect("mongodb://localhost/sga_v_1_0_TESTING", {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("we are connected!!!");
});



var app = express();
if (process.env.IS_ON_WEB == "False") {
  app.use(connectLiveReload());
}

var http = require("http").Server(app);
var io = require("socket.io")(http);


const {isLoggedIn, hasCourseAccess, hasStaffAccess, isOwner, isAdmin} = require('./routes/authFunctions.js');


// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.disable('etag'); // get rid of 304 error?

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/*************************************************************************
     HERE ARE THE AUTHENTICATION ROUTES
**************************************************************************/

//app.use(session({ secret: 'zzbbyanana',resave: false,  saveUninitialized: false }));
app.use(session(
  {
    secret: "zzbbyanana",
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 24 * 60 * 60 * 1000}, // allow login for one day...
    store: new MongoStore({mongooseConnection: mongoose.connection}),
  })
);
app.use(flash());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(auth);
app.use(similarity);


/*
  the user must be logged in to access any of the routes below
*/
app.use(isLoggedIn);

// this can be used to require onlyh brandeis people have access 
// app.use((req, res, next) => {
//   if (true || req.user.googleemail.endsWith("@brandeis.edu")) {
//     next();
//   } else {
//     res.send("You must have a Brandeis email to use this Peer Review App server\n " + "You can set up your own server. The code is at http://github.com/tjhickey724/PeerReviewApp branch v2.1 ");
//   }
// });

app.use('/mathgrades',mathgrades);

//const approvedLogins = ["tjhickey724@gmail.com", "csjbs2018@gmail.com"];






app.get("/lrec", isLoggedIn, 
 async (req, res, next) => {
  try {

    let loginer = await User.findOne({_id: req.user._id});
    if (loginer) {
      loginer.logintime = loginer.logintime || [];
      loginer.logintime.push(new Date());
      loginer.markModified("logintime");
      //console.log("updating ta "+ta._id)
      //console.dir(ta)
      await loginer.save();
    }
    res.redirect("/");
  } catch (e) {
    next(e);
  }
});


app.get("/", isLoggedIn,
  async (req, res, next) => {
  /*
    this is the main page with links to all of the courses
    the user is enrolled in or teaching. It only requires that
    they be logged in and they can create a new course or join an
    existing course if they have the course pin.
  */
  if (!req.user) next();

  let coursesOwned = await Course.find({ownerId: req.user._id}, "name");
  res.locals.coursesOwned = coursesOwned;
  res.locals.coursesTAing = [];

  let registrations = await CourseMember.find({studentId: req.user._id}, "courseId");
  res.locals.registeredCourses = registrations.map((x) => x.courseId);

  let coursesTaken = await Course.find({_id: {$in: res.locals.registeredCourses}}, "name");
  res.locals.coursesTaken = coursesTaken;

  let coursesTAing = await Course.find({_id: {$in: req.user.taFor}});
  res.locals.coursesTAing = coursesTAing;

  res.locals.title = "PRA";

  res.locals.routeName = " index";
  res.render("index");
});

/* 
  this handles all routes dealing with reviews
  the user must have proper authentication to access these routes
*/
app.use(reviews);

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
  res.locals.routeName = " createCourse";
  res.render("createCourse");
});

// rename this to /createCourse and update the ejs form
app.post("/createNewCourse", isLoggedIn,
  async (req, res, next) => {
  //console.dir(req.body)
  if (false && !req.user.googleemail.endsWith("@brandeis.edu")) {
    res.send("You must log in with an @brandeis.edu account to create a class. <a href='/logout'>Logout</a>");
    return;
  } else if (!(req.body.norobot == "on" && req.body.robot == undefined)) {
    res.send("no robots allowed!");
    return;
  }
  try {
    let coursePin = await getCoursePin();
    //console.dir(req.user)
    let newCourse = new Course({
      name: req.body.courseName,
      ownerId: req.user._id,
      coursePin: coursePin,
      createdAt: new Date(),
    });

    newCourse
      .save()
      .then((a) => {
        res.redirect("/");
      })
      .catch((error) => {
        res.send(error);
      });
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

app.get("/showRoster/:courseId", hasStaffAccess, 
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    const memberIds = memberList.map((x) => x.studentId);
    //console.log("memberIds = "+JSON.stringify(memberIds))
    res.locals.members = await User.find({_id: {$in: memberIds}});
    //console.dir(res.locals.members)
    res.locals.routeName = " showRoster";
    res.render("showRoster");
  } catch (e) {
    next(e);
  }
});

app.get("/dumpStats/:courseId", isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    const memberIds = memberList.map((x) => x.studentId);
    //console.log("memberIds = "+JSON.stringify(memberIds))
    const members = await User.find({_id: {$in: memberIds}});
    const grades = 
        await Answer.find({courseId:id,studentId:{$in: memberIds}})
              .populate('skills')
              .populate('studentId')
              .populate('psetId')
              .populate('problemId')
                ;
    //console.dir(res.locals.members)
    res.json(grades);
  } catch (e) {
    next(e);
  }
});

app.post("/addStudents/:courseId", isOwner, 
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    console.log("emails=");
    let emails = req.body.emails.split("\n").map((x) => x.trim());
    //console.log(emails)
    for (let e of emails) {
      let z = await User.findOneAndUpdate({googleemail: e}, {googleemail: e}, {upsert: true, new: true});
      console.log(e, z.googlename);
      let registration = {
        studentId: z._id,
        courseId: id,
        createdAt: new Date(),
      };
      let cm = await CourseMember.findOneAndUpdate({studentId: z._id, courseId: id}, registration, {upsert: true, new: true});

      console.log("inserted " + JSON.stringify(registration));
    }
    let users = await User.find({googleemail: {$in: emails}});
    console.log("number of users is " + users.length);

    res.redirect("/showRoster/" + id);
  } catch (e) {
    next(e);
  }
});


/*
  showCourse is the main page for a course
  which can only be viewed by course members
  (students, TAs, and the owner)
  it shows the course information, the problem sets, 
  and the course skills that the user has mastered
*/
app.get("/showCourse/:courseId", hasCourseAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

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
    console.dir(skillCount);
    res.locals.skillCount = skillCount;

    let skillIds = Array.from(new Set(flatten(skillLists)));
    res.locals.skills = await Skill.find({_id: {$in: skillIds}});
    let courseSkills = await CourseSkill.find({courseId: id}).populate('skillId');
    res.locals.allSkills = courseSkills.map((x) => x.skillId);
    //res.locals.allSkills = await Skill.find({courseId: id});
    res.locals.skillIds = skillIds; 
    // skillIds is a list of the ids of the skills the student has mastered

    res.locals.regradeRequests = await RegradeRequest.find({courseId: id, completed: false});

    res.locals.routeName = " showCourse";
    res.render("showCourse");
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

app.post("/joinCourse", isLoggedIn,
  async (req, res, next) => {
  try {
    let coursePin = req.body.coursePin;

    res.locals.courseInfo = await Course.findOne({coursePin: coursePin}, "name coursePin ownerId");

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    let registration = {
      studentId: res.locals.user._id,
      courseId: res.locals.courseInfo._id,
      createdAt: new Date(),
    };

    let newCourseMember = new CourseMember(registration);

    await newCourseMember.save();

    res.redirect("/showCourse/" + res.locals.courseInfo._id);
  } catch (e) {
    next(e);
  }
});

/* 
*********************************************************************
Skill routes
********************************************************************* 
*/

app.get("/showSkills/:courseId", hasCourseAccess,
  async (req, res, next) => {
  try {
    res.locals.skills = await Skill.find({courseId: req.params.courseId});
    res.locals.courseId = req.params.courseId;

    res.locals.courseSkills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    
    res.locals.routeName = " showSkills";
    res.render("showSkills");
  } catch (e) {
    next(e);
  }
});

app.get("/addSkill/:courseId", isOwner, 
  (req, res) => {
    res.locals.courseId = req.params.courseId;

    res.locals.routeName = " addSkill";
    res.render("addSkill");
});

app.post("/addSkill/:courseId",  isOwner, 
  async (req, res, next) => {
    try {
      let newSkill = new Skill({
        name: req.body.name,
        description: req.body.description,
        createdAt: new Date(),
        courseId: req.params.courseId,
      });
      await newSkill.save();

      let courseId = req.params.courseId;
      let courseSkill = new CourseSkill({
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

app.get("/removeSkill/:courseId/:skillId", isOwner, 
  async (req, res, next) => {
    await CourseSkill.findOneAndDelete({courseId: req.params.courseId, skillId: req.params.skillId});
    res.redirect("/showSkills/"+req.params.courseId);
});

app.get("/showSkill/:courseId/:skillId", hasCourseAccess,
  async (req, res, next) => {

  try {
    const skillId = req.params.skillId;
    res.locals.skillId = skillId;
    res.locals.skill = await Skill.findOne({_id: skillId});
    let courseId = res.locals.skill.courseId;
    res.locals.courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user.id;
    res.locals.routeName = " showSkill";
    res.render("showSkill");
  } catch (e) {
    console.log("Error in showSkill: " + e);
    next(e);
  }
});

app.get("/editSkill/:courseId/:skillId", isOwner,
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


app.post("/editSkill/:courseId/:skillId", isOwner,
  async (req, res, next) => {
  try {
    const skill = await Skill.findOne({_id: req.params.skillId});
    const courseId = req.params.courseId;
    skill.name = req.body.name;
    skill.description = req.body.description;
    skill.createdAt = new Date();

    await skill.save();

    res.redirect("/showSkill/" + req.params.courseId+"/"+ req.params.skillId);
  } catch (e) {
    next(e);
  }
}); 

app.get("/importSkills/:courseId", isOwner,
  async (req, res, next) => {
    res.locals.courseId = req.params.courseId;
    res.locals.courses = await Course.find({ownerId: req.user._id}).sort({name: 1});

    res.locals.routeName = " importSkills";
    res.render("importSkills");
});

app.get("/showSkillsToImport/:courseId/:otherCourseId", isOwner,
  async (req, res, next) => {
    res.locals.courseId = req.params.courseId;
    res.locals.otherCourseId = req.params.otherCourseId;
    res.locals.otherCourse = await Course.findOne({_id: req.params.otherCourseId});

    res.locals.skills = await Skill.find({courseId: req.params.otherCourseId});
    res.locals.routeName = " showSkillsToImport";
    res.render('showSkillsToImport');
});

app.get('/importAllSkills/:courseId/:otherCourseId', isOwner,
  async (req, res, next) => {
    try {
      const otherCourseId = req.params.otherCourseId;
      const skills = await Skill.find({courseId: otherCourseId});
      for (let skill of skills) {
        let courseSkills = await CourseSkill.find({courseId: req.params.courseId, skillId: skill._id});
        if (courseSkills.length == 0) {
          let courseSkill = new CourseSkill({
            courseId: req.params.courseId,
            skillId: skill._id,
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


app.get("/addProblemSet/:courseId", isOwner, 
  async (req, res, next) => {
  const id = req.params.courseId;

  const courseInfo = await Course.findOne({_id: id}, "name ownerId");
  res.locals.routeName = " addProblemSet";
  res.render("addProblemSet", {name: courseInfo.name, ownerId: courseInfo.ownerId, courseId: courseInfo._id});
});

app.post("/saveProblemSet/:courseId", isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    let newProblemSet = new ProblemSet({
      name: req.body.name,
      courseId: id,
      createdAt: new Date(),
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

app.get("/editProblemSet/:courseId/:psetId", isOwner,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.locals.routeName = " editProblemSet";
  res.render("editProblemSet");
});

app.post("/updateProblemSet/:courseId/:psetId", isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.psetId;
    const pset = await ProblemSet.findOne({_id: id});
    console.log("id=" + id);
    pset.name = req.body.name;
    pset.visible = req.body.visible == "visible";
    await pset.save();

    res.redirect("/showProblemSet/"+ pset.courseId+"/"+ id);
  } catch (e) {
    next(e);
  }
});

const getStudentSkills = async (courseId,studentId) => {
  try {
    const skills = await Answer.find({courseId:courseId,studentId: studentId}).distinct("skills");
    console.log(skills);
    return skills.map((c) => c.toString());
  } catch (e) {
    console.log("error in skills");
    console.dir(e);
    throw e;
  }
};

app.get("/showProblemSet/:courseId/:psetId", hasCourseAccess,
  async (req, res, next) => {
  console.log("in showProblemSet");
  const psetId = req.params.psetId;
  res.locals.courseId = req.params.courseId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.psetProblems = 
    await PsetProblem
          .find({psetId: psetId})
          .populate('problemId');

  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.locals.myAnswers = await Answer.find({psetId: psetId, studentId: req.user._id});
  res.locals.pids = res.locals.myAnswers.map((x) => {
    return x.problemId.toString();
  });
  res.locals.skills = await getStudentSkills(req.params.courseId,req.user._id);
  console.log("pids = ");
  console.dir(res.locals.pids);
  res.locals.routeName = " showProblemSet";
  
  //res.json(res.locals.psetProblems);
  res.render("showProblemSet");
});

// app.get("/gradeProblemSet/:courseId/:psetId/json", hasStaffAccess,
//   async (req, res, next) => {
//   const psetId = req.params.psetId;
//   const problemSet = await ProblemSet.findOne({_id: psetId});
//   const psetProblems = await PsetProblem.find({psetId: psetId}).populate('problemId');
//   //const problems = await Problem.find({psetId: psetId});
//   const problems = psetProblems.map((x) => x.problemId);
//   console.log("number of problems = "+problems.length);
//   const answers = await Answer.find({psetId: psetId});
//   const courseInfo = await Course.findOne({_id: problemSet.courseId}, "ownerId");
//   const memberList = await CourseMember.find({courseId: courseInfo._id});
//   const students = memberList.map((x) => x.studentId);


//   const studentsInfo = await User.find({_id: {$in: students}}, {}, {sort: {googleemail: 1}});

//   const taList = await User.find({taFor: courseInfo._id});
//   const taIds = taList.map((x) => x._id);

//   const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});

//   res.locals.taReviews = taReviews;
//   jsonGrades = [];
//   for (i = 0; i < studentsInfo.length; i++) {
//     let psetScore = 0;
//     let psetCount = 0; // number of problems graded by TAs
//     let jsonRow = {email: studentsInfo[i].googleemail, name: studentsInfo[i].googlename, grades: []};
//     for (j = 0; j <= problems.length - 1; j++) {
//       // find the scores of the reviews of this problem
//       const studentAnswers = answers.filter((a) => {
//         return a.studentId.equals(studentsInfo[i]._id) && a.problemId.equals(problems[j]._id);
//       });

//       const grades = taReviews.filter((r) => {
//         let zz = r.problemId && r.problemId.equals(problems[j]._id) && r.studentId && r.studentId.equals(studentsInfo[i]._id);
//         //console.log(`${zz} ${i} ${j} ${r.problemId} ${problems[j]._id} ${studentsInfo[i]._id} ${r.studentId}`)

//         return zz;
//       });
//       answerId = null;
//       if (grades.length > 0) {
//         answerId = grades[0].answerId;
//       }

//       if (studentAnswers.length == 0) {
//         jsonRow.grades.push(-1);
//       } else if (!answerId) {
//         jsonRow.grades.push(0);
//       } else {
//         let scores = grades.map((r) => r.points);
//         let avgScore = Math.ceil(scores.reduce((a, b) => a + b, 0) / scores.length);
//         psetScore += avgScore;
//         psetCount += 1;
//         jsonRow.grades.push(avgScore);
//       }
//     }
//     jsonRow.grades.push(psetScore);
//     jsonRow.grades.push(psetCount);
//     let average = psetCount > 0 ? Math.round((psetScore / psetCount) * 10) / 10 : -1;
//     jsonRow.grades.push(average);
//     jsonGrades.push(jsonRow);
//     if (psetCount > 0) {
//     }
//   }
//   res.json(jsonGrades);
// });

app.get("/gradeProblemSet/:courseId/:psetId", hasStaffAccess,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.courseId = req.params.courseId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  const psetProblems = await PsetProblem.find({psetId: psetId}).populate('problemId');
  //const problems = await Problem.find({psetId: psetId});
  const problems = psetProblems.map((x) => x.problemId);
  res.locals.problems = problems;
  console.log("number of problems = "+problems.length);
  res.locals.answers = await Answer.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  //console.log("looking up students")
  const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
  res.locals.students = memberList.map((x) => x.studentId);
  //console.log(res.locals.students)
  //console.log("getting student info")
  res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});
  //console.log(res.locals.studentsInfo)
  const taList = await User.find({taFor: res.locals.courseInfo._id});
  const taIds = taList.map((x) => x._id);
  //console.log('taIds='+JSON.stringify(taIds))
  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});
  //console.log("found "+taReviews.length+" reviews by "+taList.length+" tas")

  res.locals.taReviews = taReviews;
  //console.log(JSON.stringify(req.user._id))
  //console.log(JSON.stringify(taIds))
  let userIsOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

  if (userIsOwner || taIds.filter((x) => x.equals(req.user._id)).length > 0) {
    res.locals.routeName = " gradeProblemSet";
    res.render("gradeProblemSet");
  } else {
    res.send("You are not allowed to grade problem sets.");
  }
});

// app.get("/gradeProblemSetJSON/:courseId/:psetId", async (req, res, next) => {
//   const psetId = req.params.psetId;
//   res.locals.psetId = psetId;
//   res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
//   res.locals.problems = await Problem.find({psetId: psetId});
//   res.locals.answers = await Answer.find({psetId: psetId});
//   res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
//   //console.log("looking up students")
//   const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
//   res.locals.students = memberList.map((x) => x.studentId);
//   //console.log(res.locals.students)
//   //console.log("getting student info")
//   res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});
//   //console.log(res.locals.studentsInfo)
//   const taList = await User.find({taFor: res.locals.courseInfo._id});
//   const taIds = taList.map((x) => x._id);
//   //console.log('taIds='+JSON.stringify(taIds))
//   const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});
//   //console.log("found "+taReviews.length+" reviews by "+taList.length+" tas")

//   res.locals.taReviews = taReviews;
//   //console.log(JSON.stringify(req.user._id))
//   //console.log(JSON.stringify(taIds))
//   if (taIds.filter((x) => x.equals(req.user._id)).length > 0) {
//     res.locals.routeName = " gradeProblemSetJSON";
//     res.render("gradeProblemSetJSON");
//   } else {
//     res.send("You are not allowed to grade problem sets.");
//   }
// });
const preamble =
`
\\input{preamble.tex}
                               
\\begin{document}

\\thispagestyle{empty}
 \\setcounter{page}{1}\\noindent Name: All Problems \\hfill Section: 0 \\hfill  Math 10a: Friday Assessment \\#1 -- Sep 3

\\input{title.tex}

`;
const generateTex = (problems) => {
  let tex = preamble+"\\begin{enumerate}\n";
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
  tex += "\\end{enumerate}\n\\end{document}\n";
  return tex;
};

app.get("/downloadPersonalizedExamsAsTexFile/:courseId/:psetId", hasStaffAccess,
  async (req, res, next) => {
    const courseid = req.params.courseId;
    const psetId = req.params.psetId;
    const problemSet = await ProblemSet.findOne({_id: psetId});
    const psetProblems = await PsetProblem.find({psetId: psetId}).populate('problemId');
    const problems = psetProblems.map((x) => x.problemId);
    const students = await CourseMember.find({courseId: courseid});
    const studentIds = students.map((x) => x.studentId);
    const mastery = await Answer.find({courseId: courseid, studentId: {$in: studentIds}});
    console.log(JSON.stringify(mastery, null, 2));
    let skillMap = new Map();
    /* 
       skillMap(studentId) = [skillId1, skillId2, ...]
       shows the skills that the student has mastered.
    */
    for (let m of mastery) {
      let skills = m.skills;
      let studentId = m.studentId;
      let skillIds = skills.map((x) => x._id);
      let skillList = skillMap.get(studentId);
      skillList = skillList ? skillList.concat(skillIds) : skillIds;
      skillMap.set(studentId, skillList);
    }

  });

app.get('/downloadAsTexFile/:courseId/:psetId', hasStaffAccess,
  async (req, res, next) => {
    const psetId = req.params.psetId;
    const problemSet = await ProblemSet.findOne({_id: psetId});
    //const problems = await Problem.find({psetId: psetId});
    let psetProblems = await PsetProblem.find({psetId: psetId}).populate('problemId');  
    let problems = psetProblems.map((x) => x.problemId);
    //res.setHeader('Content-disposition', 'attachment; filename=problems.tex');
    res.setHeader('Content-type', 'text/plain');
    res.send(generateTex(problems));
    //res.send('downloadAsTexFile not implemented yet');
  });

app.get("/addProblem/:courseId/:psetId", isOwner,
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

app.post("/saveProblem/:courseId/:psetId", isOwner,
  async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    res.locals.psetId = psetId;
    res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
    const courseId = res.locals.problemSet.courseId;
    let skills = req.body.skills;
    console.log("skills=" + JSON.stringify(skills));
    console.log("typeof(skills=" + typeof skills);
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }

    let newProblem = new Problem({
      courseId: res.locals.problemSet.courseId,
      psetId: res.locals.problemSet._id,
      description: req.body.description,
      problemText: req.body.problemText,
      mimeType: req.body.mimeType,
      points: req.body.points,
      rubric: req.body.rubric,
      skills: skills,
      pendingReviews: [],
      allowAnswers: true,
      visible: req.body.visible == "visible",
      submitable: req.body.submitable == "submitable",
      answerable: req.body.answerable == "answerable",
      peerReviewable: req.body.peerReviewable == "peerReviewable",
      createdAt: new Date(),
    });

    await newProblem.save().then((p) => {
      res.locals.problem = p;
    });

    let psetProblem = new PsetProblem({
      psetId: psetId,
      problemId: res.locals.problem._id,
      createdAt: new Date(),
    });
    await psetProblem.save();

    res.locals.problems = await Problem.find({psetId: psetId});
    res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
      //res.render("showProblemSet")

    res.redirect("/showProblemSet/" +courseId+"/"+ psetId);
  } catch (e) {
    next(e);
  }
});

app.post("/updateProblem/:courseId/:probId", isOwner,
  async (req, res, next) => {
  try {
    console.log('in updateProblem')
    const problem = await Problem.findOne({_id: req.params.probId});
    const courseId = problem.courseId;
    problem.description = req.body.description;
    problem.problemText = req.body.problemText;
    problem.mimeType = req.body.mimeType;
    problem.points = req.body.points;
    problem.rubric = req.body.rubric;
    problem.createdAt = new Date();

    problem.visible = req.body.visible == "visible";
    problem.answerable = req.body.answerable == "answerable";
    problem.submitable = req.body.submitable == "submitable";
    problem.peerReviewable = req.body.peerReviewable == "peerReviewable";

    console.log("in updateProblem", problem.visible, req.body.visible, problem.submitable, req.body.submitable, problem.answerable, req.body.answerable, problem.peerReviewable, req.body.peerReviewable);
    console.dir(req.body);
    let skills = req.body.skill;
    console.log("skills=" + JSON.stringify(skills));
    console.log("typeof(skills=" + typeof skills);
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }
    problem.skills = skills;

    await problem.save();

    res.redirect("/showProblem/" +courseId+"/"+ req.params.probId);
  } catch (e) {
    next(e);
  }
});

app.get("/showProblem/:courseId/:psetId/:probId", hasCourseAccess,
  async (req, res, next) => {
  try {
    const psetProbId = req.params.psetProbId;
    res.locals.psetProbId = psetProbId;
    const courseId = req.params.courseId;
    res.locals.courseId = courseId;
    const probId = req.params.probId;
    res.locals.probId = probId;
    const psetId = req.params.psetId;
    res.locals.psetId = psetId;
    
    const psetProb = await PsetProblem.findOne({psetId: psetId, problemId: probId});
    res.locals.psetProb = psetProb;


    res.locals.problem = await Problem.findOne({_id: probId});
    res.locals.course = await Course.findOne({_id: courseId}, "ownerId");
    res.locals.answerCount = await Answer.countDocuments({problemId: probId});
    const reviews = await Review.find({psetId:psetId, problemId: probId});
    res.locals.reviewCount = reviews.length;
    res.locals.averageReview = reviews.reduce((t, x) => t + x.points, 0) / reviews.length;
    res.locals.answers = await Answer.find({psetId:psetId,problemId: probId, studentId: res.locals.user._id});

    res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
    res.locals.skillsMastered = await getStudentSkills(courseId,res.locals.user._id);
    res.locals.routeName = " showProblem";
    res.render("showProblem");
  } catch (e) {
    console.log("Error in showProblem: " + e);
    next(e);
  }
});

app.get("/startProblem/:courseId/:probId", isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: true});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+ req.params.probId);
});

app.get("/stopProblem/:courseId/:probId", isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: false});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+req.params.probId);
});

/*
*********************************************************************
Administrative Upgrades
These upgrades are needed to update the database schema
when we make changes to the app 
that require changes to the database schema
*********************************************************************
*/




const problem2psetProblem = (p) => {
  let psetProblem = {
    courseId: p.courseId,
    psetId: p.psetId,
    problemId: p._id,
    createdAt: new Date(),
  }
  return new PsetProblem(psetProblem);
}
 
const updatePsetProblems = 
/*
   This function creates a PsetProblem entry 
   for each problem in the Problem collection.
   WARNING: This function will delete all of the
    existing PsetProblem entries and replace them
    with new entries created from the Problem collection.
*/
  async (req, res, next) => {
  try {
    const problems = await Problem.find({});
    console.log('in updatePsetProblems');
    console.dir(problems[0]);
    let psetProblems = problems.map(problem2psetProblem);
    console.dir(psetProblems[0]);
    console.log(`num psetProblems = ${psetProblems.length}`);
    await PsetProblem.deleteMany({});
    let count = PsetProblem.find({}).count();
    console.log(`psetProblem count = ${count}`);
    await PsetProblem.insertMany(psetProblems);
    next();
  } catch (e) {
    next(e);
  }
}

const updateProblemMimeType =
  async (req, res, next) => {
    try {
      const problems = await Problem.find({});
      for (let p of problems) {
        if (!p.mimeType || p.mimeType == "text/plain") {
          p.mimeType = "plain";
        }
        await p.save();
      }
      next();
    } catch (e) {
      next(e);
    }
  };

const createCourseSkills =
  async (req, res, next) => {
    try {
      console.log('deleting all CourseSkills');
      await CourseSkill.deleteMany({});
      const courses = await Course.find({});
      for (let c of courses) {
        console.log(c.name);
        let skills = await Skill.find({courseId: c._id});
        for (let s of skills) {
          const courseSkillData = {
            courseId: c._id,
            skillId: s._id,
            createdAt: new Date(),
          }
          let courseSkill = new CourseSkill(courseSkillData);
          await courseSkill.save();
        }
      }
      next();
    } catch (e) {
      console.log(`error in createCourseSkills: ${e}`);
      next(e);
    }
  };


/*
this creates the ProblemCatalogCard collection
and it sets all of the problems to have mimeType="plain"
unless they already have a mimeType
*/
app.get('/upgrade_v3_0_0', 
        isAdmin,
        updatePsetProblems,
        updateProblemMimeType,
        (req,res,next) => {
          res.send("upgraded to v3.0.0");
        }
      );

/*
this creates the CourseSkill collection by adding every
skill defined in the course to the CourseSkill collection
It should only be used to upgrade to v3.1.0 because it will
delete all of the existing CourseSkill entries including
skills imported from other courses...
*/
app.get('/upgrade_v3_1_0', 
        isAdmin,
        createCourseSkills,
        (req,res,next) => {
          res.send("upgraded to v3.1.0");
        }
      )



app.get("/updateSchema", isAdmin,
  async (req, res, next) => {
  const result = await Problem.updateMany({}, {allowAnswers: true});
  //console.dir(result)
  res.redirect("/");
});



app.get('/showProblemCatalog/:courseId/:psetId', isLoggedIn,
  async (req,res,next) => {
    res.locals.routeName=" showProblemCatalog";
    res.locals.courseId = req.params.courseId;
    res.locals.psetId = req.params.psetId;
    res.locals.problems = [];
    let skills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    res.locals.skills = skills.map((x) => x.skillId);
    res.locals.skill = null;
    //res.locals.skills = await Skill.find({courseId: req.params.courseId});
    res.locals.newProblems=[];
    res.locals.psetProblems=[];
    //res.json(res.locals.skills);
    res.render('showProblemCatalog');
  }
)


app.get('/showProblemsBySkill/:courseId/:psetId/:skillId', hasCourseAccess,
  async (req,res,next) => {
    console.log(`req.params=${JSON.stringify(req.params)}`);
    res.locals.routeName=" showProblem";
    res.locals.courseId = req.params.courseId;
    res.locals.psetId = req.params.psetId;
    res.locals.skillId = req.params.skillId;
    res.locals.problems = await Problem.find({skills:req.params.skillId});
    res.locals.skill = await Skill.findOne({_id: req.params.skillId});
    let probIds = res.locals.problems.map((x) => x._id);
    let skills = 
      await CourseSkill
            .find({courseId: req.params.courseId})
            .populate('skillId');
    res.locals.skills = skills.map((x) => x.skillId);
    res.locals.psetProblems = 
      await PsetProblem
            .find({problemId: {$in: probIds}})
            .populate('courseId')
            .populate('problemId')
            .sort({createdAt: -1});
    let psetMap = {};
    for (let p of res.locals.psetProblems) {
      psetMap[p.problemId._id] = psetMap[p.problemId._id] || [];
      psetMap[p.problemId._id].push(p.createdAt);
    }
    const compDates = (a,b) => {if (a<b){return 1;} else {return -1}};
    for (let p of res.locals.problems) {
      psetMap[p._id].sort((a,b) => (a<b?1:-1));
    }

    const compProbs = (a,b) => {
      let d1 = psetMap[a._id][0];
      let d2 = psetMap[b._id][0];
      console.log(['***',d1,d2,d1<d2]);
      if (d1>d2){
        return 1;
      }else{
        return -1;
      };
    }
    console.dir(res.locals.problems.map((x) => psetMap[x._id][0]));
    console.log('sorting');
    res.locals.problems.sort(compProbs);
    console.dir(res.locals.problems.map((x) => psetMap[x._id][0]));

    console.log('psetMap=');
    console.dir(psetMap);
    res.locals.psetMap = psetMap;

    let psetProbIds = 
      res.locals.psetProblems.map((x) => x.problemId._id);
    let newProbIds = probIds.filter((x) => !psetProbIds.includes(x));
    res.locals.newProblems = 
      await Problem .find({_id: {$in:newProbIds}});
    //res.json(res.locals.problems);
    res.render('showProblemCatalog');
  }
)



app.get("/addProblemToPset/:courseId/:psetId/:probId", isOwner,
  async (req, res, next) => {
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    let psetProblem = new PsetProblem({
      psetId: psetId,
      problemId: probId,
      createdAt: new Date(),
    });
    await psetProblem.save();
    res.redirect("/showProblemSet/" + req.params.courseId+"/"+ psetId); 
  });

app.get("/removeProblem/:courseId/:psetId/:probId", isOwner,
  async (req, res, next) => {
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    await PsetProblem.deleteOne({psetId: psetId, problemId: probId});
    res.redirect("/showProblemSet/" + req.params.courseId+"/"+ psetId);
  });

app.post('/searchProblems/:courseId/:psetId', isLoggedIn,
  async (req,res,next) => {
    res.locals.courseId = req.params.courseId;
    res.locals.psetId = req.params.psetId;
    res.locals.routeName=" showProblemCatalog";
    console.log("searching for "+req.body.search);
    res.locals.skills = await Skill.find({courseId: req.params.courseId});
    res.locals.problems = 
      await ProblemCatalogCard.find(
          {tags:{$regex:req.body.search, $options: 'i'}}).populate('problemId');
    console.log("found "+res.locals.problems.length+" problems");
    res.render('showProblemCatalog');
  }
)

function getElementBy_id(id, vals) {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]["_id"] + "" == id) {
      return vals[i];
    }
  }
  return null;
}

app.get("/showAllAnswers/:courseId/:probId", hasCourseAccess,
  async (req, res, next) => {
  try {
    const probId = req.params.probId;
    res.locals.probId = req.params.probId;
    const courseId = req.params.courseId;
    res.locals.courseId = courseId;
    res.locals.problem = await Problem.findOne({_id: probId});
    const course = await Course.findOne({_id: courseId});
    // we should pass the psetId into showAllAnswers so we don't have to look it up here
    const psetProblem = await PsetProblem.findOne({courseId:courseId,problemId:probId});
    res.locals.psetId = psetProblem.psetId;
    res.locals.course = course;
    const userReviews = await Review.find({problemId: probId, reviewerId: req.user._id});
    res.locals.allSkills = await Skill.find({courseId: res.locals.problem.courseId});
    res.locals.getSkill = (id, vals) => getElementBy_id(probId, vals);
    res.locals.numReviews = userReviews.length;
    res.locals.canView = res.locals.numReviews >= 2 || req.user._id.equals(course.ownerId);
    if (!res.locals.canView) {
      res.locals.answers = [];
      res.locals.reviews = [];
    } else {
      res.locals.answers = await Answer.find({problemId: probId}).collation({locale: "en", strength: 2}).sort({answer: 1});
      res.locals.reviews = await Review.find({problemId: probId});
    }
    res.locals.isTA = req.user.taFor && req.user.taFor.includes(course._id);
    const taList = await User.find({taFor: res.locals.problem.courseId});
    res.locals.taList = taList.map((x) => x._id);
    res.locals.routeName = " showAllAnswers";
    res.render("showAllAnswers");
  } catch (e) {
    next(e);
  }
});

app.get("/editProblem/:courseId/:probId", isOwner,
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
app.post("/saveAnswer/:courseId/:psetId/:probId", hasCourseAccess,
  async (req, res, next) => {
  const probId = req.params.probId;
  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  res.locals.courseId = courseId;
  res.locals.probId = probId;
  res.locals.problem = await Problem.findOne({_id: probId});
  const problem = res.locals.problem;

  const answers = await Answer.find({studentId: req.user._id, problemId: probId});

  const answerIds = answers.map((x) => x._id);
  const reviews = await Review.find({answerId: {$in: answerIds}});
  console.log("about to try to save the new answer");
  console.dir(reviews);
  if (reviews.length > 0) {
    res.redirect("/showReviewsOfAnswer/" + answerIds[0]);
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

    // we might want to move old answers to another collection
    // rather than deleting them... or set a "deleted" flag
    await Answer.deleteMany({studentId: req.user._id, problemId: probId});

    await newAnswer.save();

    res.redirect("/showProblem/" +courseId+"/" + psetId+"/"+probId);
  }
});


app.post("/requestRegrade/:courseId/:reviewId", hasCourseAccess,
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
    console.log("The Review is:");
    console.dir(review);
    console.log("ci" + review.courseId);
    res.redirect("/showRegradeRequests/" + review.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequests/:courseId", hasStaffAccess,
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

app.get("/showRegradeRequest/:courseId/:requestId", hasStaffAccess,
  async (req, res, next) => {
  try {
    const regradeRequest = await RegradeRequest.findOne({_id: req.params.requestId});
    res.locals.regradeRequest = regradeRequest;
    res.redirect("/showReviewsOfAnswer/" + regradeRequest.answerId);
    //res.json([req.params.requestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

app.post("/updateRegradeRequest/:courseId/:regradeRequestId", hasStaffAccess, 
  async (req, res, next) => {
  try {
    let regradeRequest = await RegradeRequest.findOne({_id: req.params.regradeRequestId});
    regradeRequest.reply = req.body.reply;
    regradeRequest.completed = true;
    await regradeRequest.save();
    res.redirect("/showReviewsOfAnswer/" + regradeRequest.answerId);
    //res.json([req.params.regradeRequestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

// app.post("/giveGoodGrade/:probId/:answerId", async (req, res, next) => {
//   let answerId = req.params.answerId;
//   let userId = req.params.userId;
//   let review = req.body.review;
//   let points = req.body.points;
//   console.log("in giveGoodGrade");
//   console.log(review + " " + points);
//   console.log("req.body=");
//   console.dir(req.body);

//   const problem = await Problem.findOne({_id: req.params.probId});

//   const answer = await Answer.findOne({_id: req.params.answerId});

//   const newReview = new Review({
//     reviewerId: req.user._id,
//     courseId: problem.courseId,
//     psetId: problem.psetId,
//     problemId: problem._id,
//     answerId: req.params.answerId,
//     studentId: answer.studentId,
//     review: req.body.review,
//     points: req.body.points,
//     upvoters: [],
//     downvoters: [],
//     createdAt: new Date(),
//   });

//   await newReview.save();

//   answer.reviewers.push(req.user._id);
//   answer.numReviews += 1;

//   answer.save();

//   res.send("testing giveGoodGrade");
// });

app.get("/thumbsU/:courseId/:mode/:reviewId/:userId", hasCourseAccess,
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

app.get("/thumbsD/:courseId/:mode/:reviewId/:userId", hasCourseAccess,
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


app.get("/showAllStudentInfo/:courseId", hasStaffAccess,
  (req, res) => {
  res.redirect("/showTheStudentInfo/all/" + req.params.courseId);
});

app.get("/showStudentInfo/:courseId", hasStaffAccess,
  (req, res) => {
  res.redirect("/showTheStudentInfo/summary/" + req.params.courseId);
});

app.get("/showTheStudentInfo/:option/:courseId", hasStaffAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    // get the courseInfo
    res.locals.courseInfo = await Course.findOne({_id: id}, "name ownerId");

    const isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!(isOwner || isTA)) {
      //console.log('isOwner = '+isOwner)
      //console.log('isTA = '+isTA)
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
    /*
        await Course.findOneAndUpdate(
                {_id:courseId},
                {$set:{gradeSheet:{},gradesUpdateTime:new Date()}},
                {new:true})
*/

    res.locals.routeName = " showTheStudentInfo";

    if (req.params.option == "all") {
      res.render("showAllStudentInfo");
    } else if (req.params.option == "csv") {
      res.render("showStudentInfoCSV");
    } else {
      res.render("showStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/showOneStudentInfo/:courseId/:studentId", hasCourseAccess,
  async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId");
    res.locals.studentInfo = await User.findOne({_id: req.params.studentId});

    const isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!isOwner && !isTA && !req.user._id.equals(req.params.studentId)) {
      res.send("only the course owner and TAs and the student themselves can see this page");
      return;
    }

    // get the list of ids of students in the course
    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    res.locals.students = memberList.map((x) => x.studentId);

    res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

    const courseId = res.locals.courseInfo._id;
    res.locals.answers = 
       await Answer.find({courseId: courseId})
             .populate('skills');

    let psetProblems = await PsetProblem.find({courseId: courseId}).populate('problemId');
    console.dir(psetProblems);
    res.locals.problems = psetProblems.map((x) => x.problemId);
    // res.locals.problems = 
    //    await Problem.find({courseId: courseId})
    //         .populate('skills');

    res.locals.reviews = await Review.find({courseId: courseId});

    const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

    res.locals.gradeSheet = gradeSheet;
    res.locals.routeName = " showOneStudentInfo";

    res.render("showOneStudentInfo");
  } catch (e) {
    next(e);
  }
});

app.post("/addTA/:courseId", isOwner, 
  async (req, res, next) => {
  try {
    //console.log("in addTA handler "+req.body.email)
    let ta = await User.findOne({googleemail: req.body.email});
    if (ta) {
      ta.taFor = ta.taFor || [];
      ta.taFor.push(req.params.courseId);
      ta.markModified("taFor");
      //console.log("updating ta "+ta._id)
      //console.dir(ta)
      await ta.save();
    }
    console.log(`res.locals=${JSON.stringify(res.locals,null,5)}`);
    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.post("/removeTAs/:courseId", isOwner, 
  async (req, res, next) => {
  try {
    //console.log("in removeTAs handler ")
    //console.dir(req.body)
    //console.log(typeof req.body.ta)
    if (req.body.ta == null) {
      //console.log("nothing to delete")
    } else if (typeof req.body.ta == "string") {
      //console.log("delete "+req.body.ta)
      await User.update({_id: req.body.ta}, {$set: {taFor: []}});
    } else {
      //console.log("delete several:")
      req.body.ta.forEach(async (x) => {
        //console.log('x='+x)
        await User.update({_id: x}, {$set: {taFor: []}});
      });
    }

    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showTAs/:courseId", hasCourseAccess,
  async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId coursePin");
    res.locals.tas = await User.find({taFor: req.params.courseId});
    //console.log("in showTAs handler")
    res.locals.routeName = " showTAs";

    res.render("showTAs");
  } catch (e) {
    next(e);
  }
});

// add the studentId to each Review ...
app.get("/updateReviews", isAdmin,
  async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
    //console.log("did we get here???  Yes we did!!")
    return;
  } else {
    res.send("we aren't doing this anymore!");
    //console.log("did we get here???  Yes we did!!")
    return;
    try {
      let counter = 0;
      const reviews = await Review.find({});
      reviews.forEach(async (r) => {
        // lookup the answer, get the studentId,
        // and add it to the review, and save it...
        answer = await Answer.findOne({_id: r.answerId});
        //console.log(counter+": "+r._id+" "+answer.studentId)
        counter += 1;
        r.studentId = answer.studentId;
        await r.save();
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

// add the studentId to each Review ...
app.get("/updateReviews2", isAdmin,
  async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      // for each answer, find all of the reviews of that answer
      // create the reviewers field of the answer and set it
      let counter = 0;
      const answers = await Answer.find({});
      answers.forEach(async (a) => {
        try {
          //  answer, get the studentId,
          // and add it to the review, and save it...
          reviews = await Review.find({answerId: a._id});
          reviewers = reviews.map((r) => r.reviewerId);
          //console.log(a._id+" "+JSON.stringify(reviewers))
          a.reviewers = reviewers;
          await a.save();
        } catch (e) {
          console.log("caught an error updating an answer: " + e);
        }
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

app.get("/removeGradeSheets", isAdmin,
  async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      let counter = 0;
      const courses = await Course.find({});
      courses.forEach(async (c) => {
        // lookup the answer, get the studentId,
        // and add it to the review, and save it...
        c.gradeSheet = {};
        //console.log('updated course :'+JSON.stringify(c))
        await c.save();
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

app.get("/removeOrphanAnswers", isAdmin,
  async (req, res, next) => {
  try {
    if (req.user.googleemail != "tjhickey@brandeis.edu") {
      res.send("you are not allowed to do this!");
    } else {
      /* 
              Find all reviews whose answer has been deleted,
              and remove those reviews. 
              First we find all of the answers and create a list of the AnswerIds
              Then we find all reviews whose answer is not in that list.
              These are the orphans.
              Then we delete those orphan reviews.
          */
      console.log("in /removeOrphanAnswers");
      const answers = await Answer.find({});
      console.log("num answers is " + answers.length);
      const answerIds = answers.map((x) => x._id);
      console.log("num answerIds is " + answerIds.length);
      const orphans = await Review.find({answerId: {$not: {$in: answerIds}}});
      console.log("num orphans is " + orphans.length);
      const orphanIds = orphans.map((x) => x._id);
      const numrevsBefore = await Review.find().count();
      await Review.deleteMany({_id: {$in: orphanIds}});
      const numrevsAfter = await Review.find().count();
      res.send("before " + numrevsBefore + " after:" + numrevsAfter);
    }
  } catch (e) {
    next(e);
  }
});

app.get("/updateOfficialReviews", isAdmin,
  async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      // iterate through all answers
      // look for reviews a review by a TA
      // if found, then use it to update the answer

      let answers = await Answer.find();
      for (let answer of answers) {
        let reviews = await Review.find({answerId: answer._id});
        for (let review of reviews) {
          let reviewer = await User.findOne({_id: review.reviewerId});
          if (reviewer && reviewer.taFor && reviewer.taFor.includes(answer.courseId)) {
            answer.officialReviewId = review._id;
            answer.points = review.points;
            answer.review = review.review;
            answer.skills = review.skills;
            await answer.save();
          }
        }
      }
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
      next(e);
    }
    res.send("all done");
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

app.get("/mastery/:courseId", hasStaffAccess,
  async (req, res, next) => {
  const agg = masteryAgg(req.params.courseId);
  console.dir(agg);
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
app.get("/mastery2/:courseId", isOwner,
  async (req, res, next) => {
  const courseId = req.params.courseId;
  const agg = masteryAgg2(courseId);
  console.dir(agg);
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
      if (answer == undefined) {
        console.log("answer undefined a=" + a);
      } else if (!("studentId" in answer)) {
        console.log("answer.studentId undefined. answer =");
        console.dir(answer);
      }
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
