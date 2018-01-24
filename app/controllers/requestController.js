RequestProcess = function() {};
var request = require('request');
var setup = require('../../setup.js');
var CreditCardTransactionCollection = require('../models/transaction.js');
var Report = require('../models/report.js')
var mongoose = require('mongoose');
// Mongoose connect

// Program variables
var count = 0;
var lock = false;
var errorCount = 0;
var fileGlobal = '';
var result = '';
var reportCount = 0;

// Config request
var headers = {
    'Content-Type':     'application/json',
    'Accept':     'application/json',
    'MerchantKey':      setup.merchantkey,

};
var options = {
    url: 'https://sandbox.mundipaggone.com/Sale/',
    method: 'POST',
    headers: headers,
    body: result,
    json: true
};

// Promises

// Receive fileid from main application
// Gets one document by Priority

function find100Transactions(fileid){
    return new Promise(function (fulfill, reject){
        fileGlobal = fileid;
        Report.findOneAndUpdate({fileID: fileid},{processStatus: -1}).exec(function(err){
                if(err) return;
        });
        CreditCardTransactionCollection
            .find({$or:[{"fileID": fileid, "processStatus":0}, {"fileID": fileid, "processStatus":-1}]})
            .sort("Priority")
            .limit(100)
            .exec(function(err, Data){
                if(err) return;
                else {
                    var q = CreditCardTransactionCollection.update(
                        {_id: {$in: Data}},
                        {"processStatus":-1},
                        {multi:true});

                    q.exec(function(err,result){
                        if(err) return;
                        if(result.n >0) fulfill(selectTransaction(Data));
                        else return;
                    });
                    
                };
            });
    });
};

// Receive fileid from main application
// Gets one document by Priority

function findUniqueTransaction(fileid){
        if(lock) return;
        lock = true;

        CreditCardTransactionCollection
            .find({"fileID": fileid, "processStatus":0})
            .sort("Priority")
            .limit(10)
            .exec(function(err, Data){
                if(err) return;
                else {
                    var q = CreditCardTransactionCollection.update(
                        {_id: {$in: Data}},
                        {"processStatus":-1},
                        {multi:true});

                    q.exec(function(err,result){
                        if(err) return;
                        if(result.n >0) {
                            lock = false;
                            selectTransaction(Data);
                        }
                        else return;
                    });
                    
                };
            });
};

// Checks existence of new data.
// If it's false, checks if worker is empty.
// If there are no new data and worker is empty, rejects.

function selectTransaction(data){
        data.forEach((file,index)=>{
            //console.log("Sending: "+count);
            sendRequest(file);
            count++;
        });
}

function sendRequest(data){
         options.body = JSON.parse("{\"CreditCardTransactionCollection\":["
         + JSON.stringify(data)
         + "],\"Order\":{\"OrderReference\":\""
         + data._id
         + "\"}}");
        request(options, function (error, response, body) {
            if(error){
                ignoreError(data.fileID, data._id); 
                // REQUEST ERROR - TRY AGAIN
            } else {
                if (response.statusCode == 201) {
                    logTransaction(body.CreditCardTransactionResultCollection[0].AcquirerMessage, data.fileID, data._id);
                    // SUCCESS - LOG
                } else {
                    if(!body.ErrorReport) fulfill(logError(response.statusMessage, data.fileID, data._id));
                    else logError(body.ErrorReport.ErrorItemCollection[0].Description, data.fileID, data._id);
                    // TRANSACTION ERROR - LOG AND IGNORE
                }
            }
        });
};

function watchResponse(fileid){
        console.log("Queued: " + count);
        if(count<setup.querylimit){
            if(count==0) logReport(fileid);
            else findUniqueTransaction(fileid);
        }else{
            return;
        }
};

function logTransaction(mundiResponse,fileid,uniqueid){
        var date = new Date();
        CreditCardTransactionCollection.findByIdAndUpdate(uniqueid,
                { 
                    processStatus: 1,
                    processDate: date,
                    processMessage: mundiResponse
                }).exec(function(error){
                    count--;
                    reportCount++;
                    if(error) console.log(error);
                    else watchResponse(fileid);
                });
}

function logError(mundiResponse,fileid,uniqueid){
        var date = new Date();
        errorCount++;
        CreditCardTransactionCollection.findByIdAndUpdate(uniqueid,
                { 
                    processStatus: 2,
                    processDate: date,
                    processMessage: mundiResponse
                }).exec(function(error){
                    count--;
                    if(error) console.log(error);
                    else watchResponse(fileid);
                });
}

function ignoreError(fileid,uniqueid){
        var date = new Date();
        errorCount++;
        CreditCardTransactionCollection.findByIdAndUpdate(uniqueid,
                { 
                    processStatus: 0,
                    processDate: date,
                }).exec(function(error){
                    count--;
                    if(error) console.log(error);
                    else watchResponse(fileid);
        });
}

function logReport(fileid){
    return new Promise(function(fulfill,reject){
        var date = new Date();
        Report.findOneAndUpdate({fileID: fileid},{
            dateProcess: date,
            processStatus: 1,
            status: 1,
            $inc:{
                processErrorCount: errorCount,
                processCount: reportCount
            }
        }).exec(function(err){
            count = 0;
            lock = false;
            errorCount = 0;
            fileGlobal = '';
            reportCount = 0;
            
        });
    });
}

// Promise chaining
RequestProcess.prototype.process = function(req, res) {
  //  Report.find({fileID: fileid, processStatus:-1}).exec(function(err,report){
   //     return console.log(report.length)
     //   if (report.length!=0){
            find100Transactions(req.params.fileID);
            res.send("ok")
     //       return ({Response: "OK"});
    //    }else{
    //        return({Response: "Busy"});
    //    }
   // });
    
}
module.exports = new RequestProcess;