'use strict';

const fs   = require('fs'),
    path   = require('path'),
    jsyaml = require('js-yaml'),
    rewire = require('rewire'),
    jsonic = require('jsonic'),
    mustache = require('mustache'),
    swaggerTools = require('swagger-tools');

    const strw = rewire( './node_modules/swagger-tools/middleware/swagger-metadata.js' );


const spec       = fs.readFileSync( path.join(__dirname, 'tests/petstore-simple.yaml' ), 'utf8' );
const swaggerDoc = jsyaml.safeLoad( spec );

const services = {};

// Initialize the Swagger middleware
swaggerTools.initializeMiddleware( swaggerDoc, function () {

    const pSpec = strw.__get__( 'processSwaggerDocuments' )( swaggerDoc );

    for ( const i in pSpec ){
        for ( const j in pSpec[i].operations ){

            const operation   = pSpec[i].operations[j].operation;
            const pin         = identifyPin( operation );

            if ( !services[pin] ){
                services[pin]         = {};
                services[pin].pin     = pin;
                services[pin].name    = buildName( pin );
                services[pin].dirname = buildDirName( pin );
                services[pin].author  = swaggerDoc.info.contact.name;
                services[pin].license = swaggerDoc.info.license.name;
                services[pin].version = swaggerDoc.info.version;
                services[pin].year    = ( new Date() ).getFullYear();
                services[pin].description = swaggerDoc.info.description;
                services[pin].operations  = [];
            }

            services[pin].operations.push( { path: i,
                method      : j,
                description : extractDescription( operation ),
                pattern     : identifySenecaPattern( operation ),
                params      : extractParamObjects( operation ),
                responses   : extractResponseObjects( operation ),
                //operation   : operation
            } );

        }
    }


    //create service
    console.log( JSON.stringify( services['service:storage'], null, 4 ) );

    for ( const s in services ){
        createService( services[s] );
    }

});


/**
 *
 * @param service
 */
const createService = function ( service ) {

    const templatesDir = './templates/';
    const outputDir    = './outdir/';

    if (!fs.existsSync( outputDir )){
        fs.mkdirSync( outputDir );
    }

    if (!fs.existsSync( outputDir + '/' + service.dirname )){
        fs.mkdirSync(  outputDir + '/' + service.dirname );
    }

    fs.readdir( templatesDir, function( err, filenames ) {

        if (err) {
            throw Error( err );
        }

        filenames.forEach(function( filename ) {
            fs.readFile(templatesDir + filename, 'utf-8', function( err, content ) {
                if (err) {
                    throw Error( err );
                }

                const newFile = outputDir + '/' + service.dirname + '/' + filename.replace( /.mustache/, '' );

                fs.writeFileSync( newFile, mustache.render( content, service ) );
            });
        });
    });



    //run through mustache templater
    //write files

};


/**
 *
 * @param pin
 * @returns {string}
 */
const buildName = function ( pin ) {

    const parts = pin.split( ':' );

    return parts[1].charAt(0).toUpperCase() + parts[1].substr(1)
        + parts[0].charAt(0).toUpperCase() + parts[0].substr(1);

};


/**
 *
 * @param pin
 * @returns {string}
 */
const buildDirName = function ( pin ) {

    const parts = pin.split( ':' );

    return parts[1].toLowerCase() + '-' + parts[0].toLowerCase();

};


/**
 *
 * @param operation
 * @returns {*}
 */
const identifyPin = function ( operation ) {

    if ( operation['x-seneca-pattern'] ){

        if ( -1 !== operation['x-seneca-pattern'].indexOf(',') ){
            return operation['x-seneca-pattern'].substr( 0, operation['x-seneca-pattern'].indexOf(','));
        }

        return operation['x-seneca-pattern'];
    }

    if ( operation['x-swagger-router-controller'] ){
        return 'controller:' + operation['x-swagger-router-controller'];
    }

    if ( operation['operationId'] ){
        return 'operation:' + operation['operationId'];
    }

};


/**
 *
 * @param {object} obj
 * @returns {*}
 */
const extractDescription = function ( obj ) {

    if ( obj.externalDocs ){
        return obj.externalDocs.description + ' (' + obj.externalDocs.url + ')';
    }

    if ( obj.description ){
        return obj.description;
    }

    if ( obj.summary ){
        return obj.summary;
    }

    return "";
};


/**
 *
 * @param type
 * @param items - included in array models
 */
const swaggerTypeToJSType = function ( type, items ) {

    switch ( type ){
        case 'integer':
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'array':
            //TODO: deal with array of objects;
            return swaggerTypeToJSType( items.type ) + '[]';
        case 'string':
        default:
            return 'string';
    }

};


/**
 *
 * @param p
 * @returns {Array}
 */
const processObjectParams = function( p ){

    const objParams = [];

    objParams.push( {
        name         : p.name,
        description  : extractDescription( p ),
        required     : p.required,
        readonly     : p.readonly,
        writeOnly    : p.writeOnly,
        nullable     : p.nullable,
        externalDocs : p.externalDocs,
        example      : p.example,
        type         : 'object',
    } );


    for ( const propName in p.schema.properties ){

        const prop = p.schema.properties[propName];

        objParams.push( {
            name         : p.name + '.' + propName,
            description  : extractDescription( prop ),
            required     : p.schema.required[ propName ],
            readonly     : prop.readonly,
            writeOnly    : prop.writeOnly,
            nullable     : prop.nullable,
            externalDocs : prop.externalDocs,
            example      : prop.example,
            pattern      : prop.pattern,
            type         : swaggerTypeToJSType( prop.type, prop.items ),
        } );
    }

    return objParams;
};


/**
 *
 * @param operation
 */
const extractParamObjects = function ( operation ) {

    let params = [];

    const pattern = identifySenecaPattern( operation );

    const patternObj = jsonic( pattern );

    for ( const i in patternObj ){

        params.push( {
            name         : i,
            description  : 'Seneca pattern',
            required     : true,
            readonly     : false,
            writeOnly    : false,
            nullable     : false,
            externalDocs : null,
            example      : patternObj[i],
            type         : typeof( patternObj[i] ),
        } )
    }

    for ( const p of operation.parameters ){

        if ( p.schema && p.schema.type === 'object'){

            params = params.concat( processObjectParams( p ) );

        }
        else{
            params.push( {
                name         : p.name,
                description  : extractDescription( p ),
                required     : p.required,
                readonly     : p.readonly,
                writeOnly    : p.writeOnly,
                nullable     : p.nullable,
                externalDocs : p.externalDocs,
                example      : p.example,
                type         : swaggerTypeToJSType( p.type, p.items ),
            } )
        }

    }

    return params;
};


const extractResponseObjects = function ( operation ) {

};


    /**
 *
 * @param operation
 * @returns {*}
 */
const identifySenecaPattern = function ( operation ) {

    if ( operation['x-seneca-pattern'] ){
        return operation['x-seneca-pattern'];
    }

    let pattern = '';

    if ( operation['x-swagger-router-controller'] ){
        pattern += 'controller:' + operation['x-swagger-router-controller'];
    }


    if ( operation['x-swagger-router-controller']  && operation['operationId'] ){
        pattern += ',';
    }

    if ( operation['operationId'] ){
        pattern += 'operation:' + operation['operationId'];
    }

    return pattern;
};