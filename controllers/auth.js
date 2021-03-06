const bcrypt = require('bcryptjs');

//SCHEMA MODELS
const User = require('../models/User')



exports.getSignup = (req, res, next) => {
    if(req.user) { // if a user is already logged in 
        res.redirect(req.profileUrl);
    }

    res.render('public/signup', {
        pageTitle: 'Signup',
        pageRoute: '/signup',
        inputValues: {
            username: '',
            email: '',
            password1: '',
            password2: '',
        },
        inputErrors: []
        
    })
}

exports.postSignup = (req, res, next) => {
    const username = req.body.username || '';
    const email = req.body.email || '';
    const password1 = req.body.password1 || '';
    const password2 = req.body.password2 || '';
    //VERIFICATIONS    
    let validUsername = false
    let validEmail = false
    let validPasswordLength = false
    let validPasswordMatch = false
    
    const errors = []

    //Check if username is not taken or invalid
    if(username) {
        User.findOne({username: username})
            .then(user => {
                if(user) {
                    // console.log('USERNAMES:', user.username === username)
                    validUsername = false;
                    errors.push({
                        param: 'usernameTaken=true'
                    })
                    
                } else {
                    validUsername = true;
                }
            })
            .catch(err => console.log(err))
    } else {
        validUsername = false;
        errors.push({
            param: 'invalidUsername=true'
        })
    }
    
    //Check if email is valid && not taken or invalid
    if(email) {
        User.findOne({email: email})
            .then(user => {
                if(user) {
                    validEmail = false;
                    errors.push({
                        param: 'validEmailTaken=true'
                    })
                } else {
                    validEmail = true;
                }
            })
            .catch(err => console.log(err))
    } else { //if there's an invalid email value..
        validEmail = false;
        errors.push({
            param: 'invalidEmail=true'
        })
    }

    //Check if password length is valid
    if(password1 && password1.length >= 5) {
        validPasswordLength = true
    } else {
        validPasswordLength = false
        errors.push({
            param: 'validPasswordLength=false'
        })
    }

    //Check if password2 matches password 1
    if(password1 === password2) {
        validPasswordMatch = true
    } else {
        validPasswordMatch = false
        errors.push({
            param: 'validPasswordMatch=false'
        })
    }

    //VERIFY ALL INPUTS
    setTimeout(() => {
        console.log('READY: ', errors)
        if(
            validUsername 
            && validEmail 
            && validPasswordLength 
            && validPasswordMatch
        ) {
            const salt = bcrypt.genSaltSync(10);
            const newUser = new User({
                username: username,
                email: email.toLowerCase(),
                password: bcrypt.hashSync(password1, salt),
                numOfBooksRead: 0,
                profilePicUrl: 'https://lakewangaryschool.sa.edu.au/wp-content/uploads/2017/11/placeholder-profile-sq.jpg'
            })

            newUser.save()

            res.redirect('/login')

        } else {
            res.render('public/signup', {
                pageTitle: 'Signup',
                pageRoute: '/signup',
                inputValues: {
                    username,
                    email,
                    password1,
                    password2 
                },
                inputErrors: errors
            })
        }
    }, 1000)
}



exports.getLogin = (req, res, next) => {
    if(req.user) { // if a user is already logged in 
        res.redirect(req.profileUrl);
    }

    res.render('public/login', {
        pageTitle: 'Login',
        pageRoute: '/login',
        errors: [],
        inputData: {
            email: '',
            password: ''
        }
    })
}

exports.postLogin = (req, res, next) => {
    const email = req.body.email.toLowerCase() || ''
    const password = req.body.password || ''

    const errors = []

    //Verify if email & password are not empty or undefined (falsey)
    if(!email) {
        errors.push({
            param: 'email=false'
        })
    }
    if(!password) {
        errors.push({
            param: 'password=false'
        })
    }

    if(email && password) {

        User.findOne({email})
            .then(user => {
                if(!user) {
                    errors.push({
                        param: 'user=false'
                    })

                    res.render('public/login', {
                        pageTitle: 'Login',
                        pageRoute: '/login',
                        errors: errors,
                        inputData: {
                            email,
                            password
                        }
                    })
                } else {
                    console.log('USER LOGGED IN:', user)

                    if(!bcrypt.compareSync(password, user.password)) {
                        console.log(":::::BCRYPT WRONG PASSWORD::::::")
                        errors.push({
                            param: 'ValidUserPassword=false'
                        })
    
                        res.render('public/login', {
                            pageTitle: 'Login',
                            pageRoute: '/login',
                            errors: errors,
                            inputData: {
                                email,
                                password
                            }
                        })
                        
                    } else if(bcrypt.compareSync(password, user.password)) { //Do something (login)
                            console.log(":::::LOGIN BCRYPT SUCCESSFUL::::::::::::::::")

                        profileUrl = `/user/${user._id}/profile`
                        req.session.isLoggedIn = true;
                        req.session.profileUrl = profileUrl  
                        req.session.user = user
                        
                        return req.session.save(err => {
                            console.log('SESSION.SAVE ERROR', err);
                            res.redirect(profileUrl);
                        })
                    }
                }
            })
            .catch(err => console.log(err))

    } else {
        res.render('public/login', {
            pageTitle: 'Login',
            pageRoute: '/login',
            errors: errors,
            inputData: {
                email,
                password
            }
        })
    }
}

exports.getLogout = (req, res, next) => {
    req.session.destroy(err => {
        console.log(err);
        res.redirect('/login');
    })
}