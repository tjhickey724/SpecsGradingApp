"use strict";
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

// const bcrypt = require("bcrypt"),
//   SALT_WORK_FACTOR = 10;

//var userSchema = mongoose.Schema( {any:{}})

var userSchema = Schema({
  googleid: String,
  googletoken: String,
  googlename: String,
  googleemail: String,
  // password: String,
  // localpw: String,
  // taFor: [Schema.Types.ObjectId],
  // logintime: [Date]
});

userSchema.plugin(passportLocalMongoose, {usernameField: "googleemail"});

// userSchema.pre('save', function (next) {
//   var user = this;

//   // only hash the password if it has been modified (or is new)
//   if (!user.isModified("localpw")) return next();

//   // generate a salt
//   bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
//     if (err) return next(err);

//     // hash the password using our new salt
//     bcrypt.hash(user.localpw, salt, function (err, hash) {
//       if (err) return next(err);

//       // override the cleartext password with the hashed one
//       user.localpw = hash;
//       next();
//     });
//   });
// });

// userSchema.methods.comparePassword = function (candidatePassword, cb) {
//   bcrypt.compare(candidatePassword, this.localpw, function (err, isMatch) {
//     if (err) return cb(err);
//     cb(null, isMatch);
//   });
// };

module.exports = mongoose.model("User", userSchema);

/*
newUser.google.id    = profile.id;
newUser.google.token = token;
newUser.google.name  = profile.displayName;
newUser.google.email = profile.emails[0].value; // pull the first email
*/
