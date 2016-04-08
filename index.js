require('./bootstrap') // Setup error handlers
require('songbird')

let bodyParser = require('body-parser')
let cookieParser = require('cookie-parser')
let express = require('express')
let session = require('express-session')
let passport = require('passport')
let LocalStrategy = require('passport-local').Strategy
let wrap = require('nodeifyit')
let crypto = require('crypto')
let SALT = 'CodePathHeartNodeJS'
let flash = require('connect-flash')
let mongoose = require('mongoose')
let User = require('./user')


let port = process.env.PORT || 8000

/*let user = {
    email: 'foo@foo.com',
    password: crypto.pbkdf2Sync('asdf', SALT, 4096, 512, 'sha256').toString('hex')
}*/

mongoose.set("debug", true);
// connect to the database
mongoose.connect('mongodb://127.0.0.1:27017/authentication1',function(err) {
    if (err) throw err;
   console.log('Successfully connected to MongoDB mongodb://127.0.0.1:27017/authentication1')

});



passport.use(new LocalStrategy({
    usernameField: 'email' // Use "email" field instead of "username"
}, wrap(async (email, password) => {
    email = (email || '').toLowerCase()
    if (email !== user.email) {
        return [false, {message: 'Invalid username'}]
    }
   /* if (password !== user.password) {
        return [false, {message: 'Invalid password'}]
    }*/
    let passwordHash = await crypto.promise.pbkdf2(password, SALT, 4096, 512, 'sha256')
       if (passwordHash.toString('hex') !== user.password) {
           return [false, {message: 'Invalid password'}]
       }
    return user
}, {spread: true})))

passport.use('local-signup', new LocalStrategy({
   usernameField: 'email'
}, wrap(async (email, password) => {
    email = (email || '').toLowerCase()

    if (await User.promise.findOne({email})) {
        return [false, {message: 'That email is already taken.'}]
    }

    let user = new User()
    user.email = email

    // Store password as a hash instead of plain-text
    user.password = (await crypto.promise.pbkdf2(password, SALT, 4096, 512, 'sha256')).toString('hex')
    return await user.save()
}, {spread: true})))

passport.serializeUser(wrap(async (user) => user.email))
/*passport.deserializeUser(wrap(async (id) => user))*/

passport.deserializeUser(wrap(async (email) => {
    return await User.findOne({email}).exec()
}))


let app = express()
app.use(cookieParser('ilovethenodejs')) // Session cookies
app.use(bodyParser.json()) // req.body for PUT/POST requests (login/signup)
app.use(bodyParser.urlencoded({ extended: true }))

// In-memory session support, required by passport.session()
app.use(session({
  secret: 'ilovethenodejs',
  resave: true,
  saveUninitialized: true
}))

app.use(passport.initialize()) // Enables passport middleware
app.use(passport.session()) // Enables passport persistent sessions

app.use(flash())
app.use(express.static('public'))


app.set('view engine', 'ejs')

// And add your root route after app.listen
app.get('/', (req, res) => res.render('index.ejs', {message: req.flash('error')}))

app.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/',
    failureFlash: true
}))

app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile',
    failureRedirect: '/',
    failureFlash: true
}))

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next()
    res.redirect('/')
}
app.get('/profile', isLoggedIn, (req, res) => res.render('profile.ejs', {}))

app.listen(port, ()=> console.log(`Listening @ http://127.0.0.1:${port}`))