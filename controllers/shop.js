const Product = require('../models/product');
const Order = require('../models/order');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const stripe = require('stripe')(process.env.STRIPE_KEY);

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {

  let page;
   if(!req.query.page){
     page= 1;
   }else{
     page = +req.query.page;  
   }
  let totalProducts;

  //console.log(page);

  Product.find()
    .countDocuments()
    .then(numProducts =>{
         totalProducts = numProducts;
         return Product.find()
           .skip((page-1)*ITEMS_PER_PAGE)
           .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      //console.log(products);
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        curPage:page,
        hasNextPage:page*ITEMS_PER_PAGE < totalProducts,
        nextPage: page+1,
        prevPage: page-1,
        hasPrevPage: page>1,
        lastPage: Math.ceil(totalProducts/ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  let page;
   if(!req.query.page){
     page= 1;
   }else{
     page = +req.query.page;  
   }
  let totalProducts;

  //console.log(page);

  Product.find()
    .countDocuments()
    .then(numProducts =>{
         totalProducts = numProducts;
         return Product.find()
           .skip((page-1)*ITEMS_PER_PAGE)
           .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      //console.log(products);
      res.render('shop/index', {
        prods: products,
        pageTitle: 'All Products',
        path: '/',
        curPage:page,
        hasNextPage:page*ITEMS_PER_PAGE < totalProducts,
        nextPage: page+1,
        prevPage: page-1,
        hasPrevPage: page>1,
        lastPage: Math.ceil(totalProducts/ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      //console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.checkoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req,res,next) =>{
    console.log("reached in getINvoice");
    const orderId = req.params.orderId;
    console.log(orderId);
   Order.findById(orderId)
    .then(order=>{
      if(!order){
        console.log("error 1 ");
        return next(new Error('No such order found'));
      }

      if(order.user.userId.toString() !== req.user._id.toString()){
        console.log("error 2");
        return next(new Error('UnAuthorised'));
      }

      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);
      const pdfDoc= new PDFDocument();
      console.log(invoiceName);
      console.log(invoicePath);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition','inline;filename=" ' + invoiceName +'" ');

      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('INVOICE',{underline:true});
      pdfDoc.text('---------------------------');
      let totalPrice = 0;
      order.products.forEach(prod =>{
         totalPrice += prod.product.price;
         pdfDoc.fontSize(16).text( prod.product.title + ' - ' + prod.quantity + ' X ' + '$'+ prod.product.price);
      });

      pdfDoc.text('---------------------------');
      
      // fs.readFi(invoicePath,(err,data)=>{
      //   if(!err){
      //     res.send(data);
      //   }else{
      //     console.log("some error occured in getting invoice");
      //   }
      // });
      pdfDoc.fontSize(20).text('TOTALPRICE' + ' - ' + totalPrice);
      pdfDoc.end();

    })
    .catch(err =>{
      console.log("error at end ");
      return next(new Error(err));
    })
    
}

// exports.getCheckout = (req,res,next) =>{

//    let products,total=0;

//   req.user
//   .populate('cart.items.productId')
//   .execPopulate()
//   .then(user => {
//     //console.log(user.cart.items);
//      products = user.cart.items;
//      products.map( p =>{
//       total += p.quantity * p.productId.price;
//     });
//     console.log(total);
//      return stripe.checkout.session.create({
//        payment_method_type:['card'],
//        line_items: products.map(p =>{
//          return {
//            name: p.productId.title,
//            description: p.productId.description,
//            amount: p.productId.price,
//            currency: 'usd',
//            quantity: p.quantity
//          };
//        }),
//        success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
//        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'

//      });
//   })
//   .then(session =>{
//         res.render('shop/checkout',{
//           products:products,
//           sessionId:session.id,
//           totalSum:total,
//           path: '/checkout',
//           pageTitle: 'Checkout',
//         });
//   })
//   .catch(err =>{
//     console.log('cant get stripe page');
//     return next(new Error(err));
//   })

// }

exports.getCheckout = (req,res,next) =>{
   let total=0;
   let products;
   req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user =>{
         products = user.cart.items;
        //console.log(products);
        products.forEach(p =>{
           total += p.quantity * p.productId.price;
        });
         
        return stripe.checkout.sessions.create({
                 payment_method_types:['card'],
                 line_items: products.map(p =>{
                   return {
                     name: p.productId.title,
                     description: p.productId.description,
                     amount: p.productId.price,
                     currency:'INR',
                     quantity: p.quantity
                   };
                 }),
                 mode:'payment',
                 success_url: 'http://localhost:3000/checkout/success',
                 cancel_url:'http://localhost:3000/checkout/cancel'
          
               });
    })
    .then(session =>{
      //console.log("get session");
      console.log(session);

      res.render('shop/checkout',{
        path:'/checkout',
        sessionId:session.id,
        pageTitle: 'Checkout',
        products:products,
        totalSum:total
      });
    })
    .catch(err =>{
      console.log(err);
      console.log("cant get checkout");
      return next(err);
    })
}