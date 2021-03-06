const User = require('../models/User');
const Review = require('../models/Review');

const bcrypt = require('bcryptjs');
const multer = require('multer');
const cloudinary = require('cloudinary');
const path = require('path');
const Datauri = require('datauri');
const dUri = new Datauri();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.getProfile = (req, res, next) => {
    const userId = req.params.userId;
    let isOwnUserProfile = false
    let createdAt;

    User.findById(userId)
        .then(user => {
            if(!user) {
                res.redirect('/login')
            }
            
            createdAt = user.createdAt.toString().split('').map((c, i) => {
                if(i <= 14 && i > 3) {
                    return c
                }
            }).join('')

            if(user._id.toString() === req.user._id.toString()) { 
                isOwnUserProfile = true
            }

            return user

        })
        .then(user => {
            Review.find({author: user._id})
                .populate('author')
                .exec()
                .then(userReviews => {

                    const savedBooks = user.savedBooks;

                    console.log(savedBooks)

                    res.render('private/profile', {
                    pageTitle:`${user.username}'s Profile`, 
                    pageRoute: '/profile',
                    profilePicUrl: user.profilePicUrl,
                    username: user.username,
                    email: user.email,
                    memberSince: createdAt,
                    booksRead: user.reviews.length,
                    reviews: userReviews,
                    isUserProfile: isOwnUserProfile,
                    url: req.url,
                    userId,
                    savedBooks
                })

            })
        })
        .catch(err => {
            console.log(':::::No user found:::::', err)
            res.redirect('/login')
        })

}

exports.getEditProfile = (req, res, next) => {
    const userId = req.params.userId;
    console.log('USERID EDIT: ', userId)

    User.findById(userId)
        .then(user => {
            if(!user) {
                res.redirect(`/user/${req.user._id}/profile`)
            }

            if(req.user._id.toString() === user._id.toString()) {
                res.render('private/profile-edit', {
                    pageTitle:`${user.username}'s Profile`, 
                    pageRoute: '/profile',
                    username: user.username,
                    email: user.email,
                    url: req.url,
                    inputErrors: []
                })
            } else {
                res.redirect(req.profileUrl)
            }

        })
        .catch(err => console.log(':::::GET EDIT ERROR:::::', err))
}

exports.postEditProfile = (req, res, next) => {
    const storage = multer.memoryStorage()
    const upload = multer({ storage: storage }).single('profileImage')
    
    upload(req, res, (err) => {
        //MULTER ERRORS
        if (err instanceof multer.MulterError) {
            console.log('ERR1: ', err)
            // A Multer error occurred when uploading.
        } else if (err) {
            console.log('ERR???: ', err)
            // An unknown error occurred when uploading.
        }
        const userId = req.params.userId;
        const newUsername = req.body.username;
        const newEmail = req.body.email.toLowerCase();
        const inputErrors = []

        const dataUri = req => {
            return dUri.format(path.extname(req.file.originalname).toString(), req.file.buffer)
        }
        console.log("REQ BODY: ", req.body)
        console.log("REQ FILE: ", req.file)

        if(userId !== req.user._id.toString()) { // Not Authorized user
            res.redirect(`/user/${req.user._id}/profile/edit`)
        }
        
        //If the user IS AUThORIZED
        User.findById(userId)
            .then(user => {
                //INVALID USER ERRROS
                if(!user) {
                    res.redirect(`/user/${req.user._id}/profile/edit`) //No user found
                }
                //INVALID IMAGE FILE
                if(req.file) {
                    //IF IMAGE IS THE RIGHT EXTENTION
                    if( req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/png') {
                         console.log(req.file.mimetype === 'image/jpeg')
                         console.log(req.file.mimetype === 'image/png')
                    } else {
                        console.log('INVALID IMAGE FILE::::::::')        
                        inputErrors.push({
                            param: "invalidImage=true"
                        })
                    }
                }
                //INVALID INPUT VALUES ERRORS
                if(newUsername.trim() === "") { //invalid username value
                    inputErrors.push({
                        param: "invalidUsername=true"
                    })
                }
                if(newEmail.trim() === "") { //invalid email value
                    inputErrors.push({
                        param: "invalidEmail=true"
                    })
                }

                if(inputErrors.length > 0) { //Render with error messages
                    res.render('private/profile-edit', {
                        pageTitle:`${user.username}'s Profile`,
                        pageRoute: '/profile',
                        username: newUsername,
                        email: newEmail,
                        url: req.url,
                        inputErrors: inputErrors
                    })
                    throw new Error("Image file invalid");

                } else {
                    return user
                }
            })
            .then(user => {
                return User.findOne({email: newEmail})
            })
            .then(emailUser => {
                if(!emailUser) { // if no other user has that email
                    return User.findById(userId)
                } else {
                    console.log(emailUser._id, req.user._id, emailUser._id.toString() === req.user._id.toString())

                    if (emailUser._id.toString() === req.user._id.toString()) {
                        return User.findById(userId)
                    } else {
                        console.log('EMAIL ALREADY IN USE')

                        inputErrors.push({
                            param: "usedEmail=true"
                        })

                        res.render('private/profile-edit', {
                            pageTitle:`${req.user.username}'s Profile`,
                            pageRoute: '/profile',
                            username: newUsername,
                            email: newEmail,
                            url: req.url,
                            inputErrors: inputErrors
                        })
        
                        throw new Error('EMAIL ALREADY IN USE')
                    }

                }
                
            })
            .then(user => {
                user.username = newUsername;
                user.email = newEmail;

                //SEND EMAIL---------------------------

                if(req.file) {
                    // UPLOAD, SAVE & REDIRECT!
                    const file = dataUri(req).content;
                    cloudinary.v2.uploader.upload(file, (err, result) => {
                        if(err) {
                            console.log("::: CLOUDINARY UPLOAD ERROR :::", err);         
                        }
                        console.log("::: CLOUDINARY UPLOAD RESULT :::", result);
    
                        //SET PIC & SAVE
                        user.profilePicUrl = result.secure_url;
                        user.save();
                        res.redirect(`/user/${req.user._id}/profile`)
                    });
                } else {
                    //SAVE USER
                    user.save();
                    res.redirect(`/user/${req.user._id}/profile`)   
                }
            })
            .catch(err => console.log('::: EDIT PROFILE ERROR :::', err))
    }) 
}

exports.getProfileSettings = (req, res, next) => {
    const userId = req.params.userId;
    console.log('USERID SETTINGS: ', userId)

    User.findById(userId)
        .then(user => {
            if(!user) {
                res.redirect(`/user/${req.user._id}/profile`)
            }

            if(req.user._id.toString() === user._id.toString()) {
                
                res.render('private/profile-settings', {
                    pageTitle:`${user.username}'s Settings`, 
                    pageRoute: '/profile',
                    url: req.url,
                    inputErrors: []
                })
            } else {
                res.redirect(req.profileUrl)
            }

        })
        .catch(err => console.log(':::::GET EDIT ERROR:::::', err))
}

exports.postProfileSettings = (req, res, next) => {
    const userId = req.params.userId;
    const oldPassword = req.body.oldPassword;
    const newPassword1 = req.body.newPassword1;
    const newPassword2 = req.body.newPassword2;
    const inputErrors = [];
    
    User.findById(userId)
        .then(user => {
            //INVALID USER ERRROS
            if(!user) {
                res.redirect(`/user/${req.user._id}/profile/settings`)  //No user found
            }
            if(user._id.toString() !== req.user._id.toString()) {   //Diferent user
                res.redirect(`/user/${req.user._id}/profile/settings`)
            }

            //INVALID INPUT VALUES ERRORS
            if(bcrypt.compareSync(oldPassword, user.password)) { // Correct (old/current) password
                console.log('CORRECT PASSWORD')
                return user;
            } else {
                inputErrors.push({
                    param: "invalidOldPassword=true"
                })
                console.log('WRONG PASSWORD')
                res.render('private/profile-settings', {
                    pageTitle:`${user.username}'s Settings`, 
                    pageRoute: '/profile',
                    url: req.url,
                    inputErrors
                })
            }
        })
        .then(user => { //CORRECT OLD PASSWORD
            if(newPassword1.trim() === "" || newPassword1.trim().length < 5) { //invalid new password 1 value
                inputErrors.push({
                    param: "invalidNewPassword1=true"
                })
            }
            if(newPassword2.trim() !== newPassword1.trim()) { //invalid password 2 value
                inputErrors.push({
                    param: "invalidNewPassword2=true"
                })
            }

            if(inputErrors.length === 0) { // render with error msgs
                return user
            }
            res.render('private/profile-settings', {
                pageTitle:`${user.username}'s Settings`, 
                pageRoute: '/profile',
                url: req.url,
                inputErrors
            })
            throw new Error('invalid new password values');
        })
        .then(user => {
            console.log('ALL VALIDATIONS PASSSED!!')
            const salt = bcrypt.genSaltSync(10);

            user.password = bcrypt.hashSync(newPassword1, salt);
            user.save()
            res.redirect(`/user/${req.user._id}/profile`);

        })
        .catch(err => {
            console.log('PASSWORD EDIT ERROR', err)
        })


    // res.redirect(`/user/${req.user._id}/profile`)
}

exports.postReview = (req, res, next) => {
    const bookId = +req.params.bookId
    const bookTitle = req.body.bookTitle
    const reviewTitle = req.body.reviewHeading.trim()
    const reviewReview = req.body.reviewBody.trim()
    let reviewRating = [];

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
    console.log(bookId)
    console.log(bookTitle)
    console.log(reviewTitle)
    console.log(reviewReview)
    console.log(req.body.reviewRating)

    for (let i = 1; i <= 5; i++) {
        if(i <= req.body.reviewRating) {
            reviewRating.push('*')
        } else {
            reviewRating.push('-')
        }
    }

    console.log(reviewRating)
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")

    console.log('BOOK TITLE', bookTitle)
    if(reviewTitle && reviewReview && reviewRating && req.user) {
        const newReview = new Review({
            bookId: bookId,
            bookTitle: bookTitle,
            title: reviewTitle,
            review: reviewReview,
            rating: reviewRating,
            author: req.user._id
        })
        newReview.save();
        req.user.reviews.push(newReview._id)
        req.user.save()
        console.log(':::::BOOK SAVED::::::')
        res.redirect(`/book/${bookId}`)

    } else {
        res.redirect(`/book/${bookId}`)
    }

}

exports.getEditReview = (req, res, next) => {
    const userId = req.params.userId
    const reviewId = req.params.reviewId
    
    User.findById(userId)
        .then(user => {
            if(!user) {
                console.log('NO USER')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            if(user._id.toString() !== req.user._id.toString()) {
                console.log('NO AUTH')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            const userReview = user.reviews.find(r => r._id.toString() === reviewId.toString())
            
            
            if(userReview) {
                Review.findById(reviewId)
                    .then(review => {

                        let rating = 0;

                        review.rating.forEach(el => {
                            if (el === '*') {
                                rating += 1
                            }
                        })

                        res.render('private/review-edit', {
                            pageTitle: 'Edit Review',
                            pageRoute: '/review',
                            reviewTitle: review.title,
                            review: review.review,
                            reviewRating: rating,
                            formAction: req.url
                        })
                        
                    })
                
            } else {
                console.log('NO userReview')
                res.redirect(`/user/${req.user._id}/profile`)
            }  
        })
}

exports.postEditReview = (req, res, next) => {
    const userId = req.params.userId
    const reviewId = req.params.reviewId

    User.findById(userId)
        .then(user => {
            if(!user) {
                console.log('NO USER')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            if(user._id.toString() !== req.user._id.toString()) {
                console.log('NO AUTH')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            const userReview = user.reviews.find(r => r._id.toString() === reviewId.toString())
            
            
            if(userReview) {
                Review.findById(reviewId)
                    .then(review => {
                        const newTitle = req.body.newReviewTitle;
                        const newReview = req.body.newReview;
                        let newRating = [];

                        for (let i = 1; i <= 5; i++) {
                            if(i <= req.body.newReviewRating) {
                                newRating.push('*')
                            } else {
                                newRating.push('-')
                            }
                        }

                        review.title = newTitle;
                        review.review = newReview;
                        review.rating = newRating;
                        review.save();

                    })
                    .then(result => {
                        res.redirect(`/user/${req.user._id}/profile`)
                    })
                
            } else {
                console.log('NO userReview')
                res.redirect(`/user/${req.user._id}/profile`)
            }

        })


}

exports.getDeleteReview = (req, res, next) => {
    const userId = req.params.userId
    const reviewId = req.params.reviewId
    
    User.findById(userId)
        .then(user => {
            if(!user) {
                console.log('NO USER')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            if(user._id.toString() !== req.user._id.toString()) {
                console.log('NO AUTH')
                res.redirect(`/user/${req.user._id}/profile`)
            }
            
            const userReview = user.reviews.find(r => r._id.toString() === reviewId.toString())
            
            
            if(userReview) {
                Review.findByIdAndDelete(reviewId)
                    .then(result => {
                        const newUserReviewsArr = user.reviews.filter(revs => revs.toString() !== reviewId.toString())
                        console.log('REVIEW DELETED')
                        user.reviews = newUserReviewsArr
                        
                        user.save()
                        res.redirect(`/user/${req.user._id}/profile`)
                    })
                
            } else {
                console.log('NO userReview')
                res.redirect(`/user/${req.user._id}/profile`)
            }

        })

}

exports.saveBook = (req, res, next) => {
    if(!req.user) {
        res.redirect('/login')
    }
    
    const bookId = req.params.bookId;
    const bookImage = req.body.bookImage;
    const bookTitle = req.body.bookTitle
    const user = req.user;

    user.savedBooks.push({
        bookId,
        bookTitle,
        bookImage
    })

    user.save();

    res.redirect(`/book/${bookId}`)
}

exports.deleteBook = (req, res, next) => {
    if(!req.user) {
        res.redirect('/login')
    }

    const bookId = req.params.bookId;
    const user = req.user;

    const newSavedBooks = user.savedBooks.filter(b => b.bookId !== bookId);

    user.savedBooks = newSavedBooks;
    user.save();

    res.redirect(`/book/${bookId}`)
}