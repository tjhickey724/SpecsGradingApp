/*
  auth.js handles all of the authentication routes
*/
const express = require("express");
const app = express.Router();

// Authentication
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
// here we set up authentication with passport
const passport = require("passport");
const configPassport = require("../config/passport");
configPassport(passport);

const User = require("../models/User");
const Instructor = require("../models/Instructor");

// here are the authentication routes
app.use(passport.initialize());
app.use(passport.session());

// here is where we check on their logged in status
app.use(async (req, res, next) => {
    res.locals.loggedIn = false;
    if (req.isAuthenticated()) {
      res.locals.user = req.user;
      res.locals.loggedIn = true;


    } else {
      res.locals.user={};
      res.locals.loggedIn = false;
    }
    next();
  });

app.get("/loginerror", function (req, res) {
    res.locals.routeName = " loginerror";
    res.render("loginerror", {}); 
  });
  
  app.get("/login", function (req, res) {
    res.locals.routeName = " login";
    res.locals.allow_local_login = (false || process.env.ALLOW_LOCAL_LOGIN);
    console.log('in /login: allow_local_login = '+res.locals.allow_local_login);
    res.render("login", {});
  });
  
  // route for logging out
  app.get("/logout", function (req, res) {
    req.session.destroy((error) => {
      console.log("Error in destroying session: " + error);
    });
    req.logout();
    res.redirect("/");
  });
  
  // =====================================
  // GOOGLE ROUTES =======================
  // =====================================
  // send to google to do the authentication
  // profile gets us their basic information including their name
  // email gets their emails
  app.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}));
  
  app.get(
    "/login/authorized",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/loginerror",
    })
  );
  
  app.get("/login/local", async (req, res, next) => {
    res.locals.routeName = " login";
    res.render("localLogin");
  });
  
  app.post("/auth/local/register", async function (req, res, next) {
   try{
    console.log("registering user");
    /* handle the case where we have already created a user
       before they have registered. The idea is to register
       the user with a temporary fake email and then copy over the
       salt and hash to the original user and delete the temporary */
    let user = await User.findOne({googleemail: req.body.username});
    if (user && !user.salt) {
      console.dir(`user ${req.body.username} already exists but has no name`);
      req.body.username="fake@"+req.body.username+"@fake.com"; // make a fake email
      console.log("registering user with fake email");
      console.dir(req.body);
      User.register(
          new User({googleemail: req.body.username, googlename: req.body.name}), 
          req.body.password, 
          async function (err,user2) {
            // user2 is the new user so we copy the salt and hash
            // to user and save it and delete user2
            if (err) {
              console.log("error while user register!", err);
              return next(err);
            }
            user.googlename = user2.googlename;
            user.salt = user2.salt;
            user.hash = user2.hash;
            console.log(`user1 = ${JSON.stringify(user)}`);
            console.log(`user2 = ${JSON.stringify(user2)}`);
            await user.save();
            await user2.remove();
            console.log("user registered!");
            res.redirect("/login/local");
          });
    } else {
      User.register(new User({googleemail: req.body.username, googlename: req.body.name}), req.body.password, function (err) {
        if (err) {
          console.log("error while user register!", err);
          return next(err);
        }
        console.log("user registered!");
        res.redirect("/login/local");
      });
    }
  } catch (err) {
    console.log("error while user register!", err);
    next(err);
  }
  });
  
  app.post("/auth/local/login", passport.authenticate("local", {failureRedirect: "/loginerror"}), function (req, res) {
    res.redirect("/");
  });

module.exports = app;
