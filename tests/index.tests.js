/**
 * Created by dmccarthy on 19/07/2016.
 */
const chai                  = require('chai');
const sinon                 = require("sinon");
const sinonChai             = require("sinon-chai");
const rewire                = require('rewire');

chai.should();
chai.use(sinonChai);

const should = chai.should();


describe('Test swagger-seneca-codegen middleware', function() {

    it( 'test index.js', function () {

        require('../index');

    } );
});