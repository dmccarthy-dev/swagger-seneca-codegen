'use strict';

const jsonic = require('jsonic');

/**
 *
 * @param swaggerDoc
 * @param operation
 */
const extractServiceDetails = function( swaggerDoc, operation ){

    const pin = identifyPin( operation );

    return {
        pin     : pin,
        name    : buildName( pin ),
        dirname : buildDirName( pin ),
        author  : swaggerDoc.info.contact.name,
        license : swaggerDoc.info.license.name,
        version : swaggerDoc.info.version,
        year    : ( new Date() ).getFullYear(),
        description : swaggerDoc.info.description
    };

};


/**
 *
 * @param operation
 * @param path
 * @param method
 */
const extractOperationDetails = function( operation, path, method ){

    return {
        path        : path,
        method      : method,
        functionName : buildName( identifyPin( operation ) ) + '.' + buildFunctionName( identifySenecaPattern( operation ) ),
        description : extractDescription( operation ),
        pattern     : identifySenecaPattern( operation ),
        params      : extractParamObjects( operation ),
        responses   : extractResponseObjects( operation ),
        //operation   : operation
    };

};






/**
 * @returns {string}
 */
const buildName = function ( pin ) {

    const parts = pin.split( ':' );

    return parts[1].charAt(0).toUpperCase() + parts[1].substr(1)
        + parts[0].charAt(0).toUpperCase() + parts[0].substr(1);

};


/**
 * converts pattern to function name.
 * Grabs the final value from the seneca pattern.
 *
 * controller:petstore,operation:findPets
 * @returns {string}
 */
const buildFunctionName = function ( pattern ) {

    return pattern.substr( pattern.lastIndexOf(':') + 1 );

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
        ob           : '{',
        cb           : '}'
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
            objProp      : true,
            type         : swaggerTypeToJSType( prop.type, prop.items ),
            ob           : '{',
            cb           : '}'
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
            description  : 'Seneca pattern parameter',
            senPatParam  : true,
            required     : true,
            readonly     : false,
            writeOnly    : false,
            nullable     : false,
            externalDocs : null,
            example      : patternObj[i],
            type         : typeof( patternObj[i] ),
            ob           : '{',
            cb           : '}'
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
                ob           : '{',
                cb           : '}'
            } )
        }

    }

    return params;
};


/**
 *
 * @param operation
 */
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


module.exports.identifyPin             = identifyPin;
module.exports.extractServiceDetails   = extractServiceDetails;
module.exports.extractOperationDetails = extractOperationDetails;