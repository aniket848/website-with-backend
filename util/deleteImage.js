const fs = require('fs');

const Delete = (filePath) =>{

    fs.unlink(filePath , (err)=>{
        if(err){
            throw(err);
        }
    });
}

exports.Delete = Delete;