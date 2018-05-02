#!/usr/bin/env node

'use strict';

const fs   = require('fs'),
    path   = require('path'),
    jsyaml = require('js-yaml'),
    rewire = require('rewire'),
    specVariables = require('./libs/specVariables'),
    templating    = require('./libs/templating'),
    swaggerTools  = require('swagger-tools'),
    strw = rewire( './node_modules/swagger-tools/middleware/swagger-metadata.js' );



/**
 *
 * Extracts the path option from the CLI params,
 * checks if it is local or absolute and then
 * checks that it exists.
 *
 * @param options
 * @param {string} val
 * @param {boolean} shouldExist
 * @returns {*}
 */
const normaliseFileParam = function ( options, val, shouldExist ) {

    if ( !options || !options[val] ){

        throw new Error( 'Target file/dir not specified' );
    }

    const file = ( path.isAbsolute( options[val] ) ? options[val] : path.join( __dirname, options[val] ) );

    if ( shouldExist && !fs.existsSync( file ) ){
        throw new Error( 'File/Dir not found: ' + file );
    }

    return file;
};



/**
 *
 * @param swaggerFile
 * @returns {Promise<any>}
 */
const processSwaggerFile = function ( swaggerFile ) {

    return new Promise( ( resolve, reject ) => {

        const spec       = fs.readFileSync( path.join( swaggerFile ), 'utf8' );
        const swaggerDoc = jsyaml.safeLoad( spec );

        const services = {};

        // Initialize the Swagger middleware
        swaggerTools.initializeMiddleware( swaggerDoc, function () {

            const pSpec = strw.__get__( 'processSwaggerDocuments' )( swaggerDoc );

            for ( const i in pSpec ){
                for ( const j in pSpec[i].operations ){

                    const operation = pSpec[i].operations[j].operation;
                    const pin       = specVariables.identifyPin( operation );

                    if ( !services[pin] ){
                        services[pin] = specVariables.extractServiceDetails( swaggerDoc, operation, i, j );
                        services[pin].operations = [];
                    }

                    //merge operations from when the pin is identical.
                    services[pin].operations.push( specVariables.extractOperationDetails( operation, i, j ) )
                }
            }

            resolve( services );
        });
    } )
};



/**
 *
 * Action function that handles the dump templates command.
 *
 * @param args
 * @param options
 */
const dumpTemplates = function ( args, options ) {

    options.template = 'templates';

    const templateDir = normaliseFileParam( options, 'template', false );
    const target      = normaliseFileParam( options, 'target', false );

    templating.dumpTemplates( templateDir, target );

};


/**
 *
 * Reads a Swagger spec file and extracts all the data that is
 * used to create the services in the moustache files.
 *
 * @param args
 * @param options
 */
const printVariables = function ( args, options ) {

    const swaggerFile = normaliseFileParam( options, 'spec', true );

    processSwaggerFile( swaggerFile ).then(value => {

        for ( const i in value ){
            console.log( "\n\n" );
            console.log( 'Pin: ' + i + '\n');
            console.log( JSON.stringify( value[i], null, 4 ) );
        }

    }).catch(reason => {
        throw  new Error( reason );
    });

};


/**
 *
 *
 * @param args
 * @param options
 */
const generate = function (  args, options   ) {

    if ( !options.template  ){
        options.template = 'templates';
    }

    const swaggerFile = normaliseFileParam( options, 'spec',   true  );
    const targetDir   = normaliseFileParam( options, 'target', false );
    const templateDir = normaliseFileParam( options, 'template', false );
    const override    = options.override;
    const standalone  = options.standalone;

    processSwaggerFile( swaggerFile ).then(value => {

        for ( const i in value ){
            templating.createService( value[i], templateDir, targetDir, override, standalone );
        }

        console.log( 'Modules/projects generated in: ' + targetDir );

    }).catch(reason => {
        throw  new Error( reason );
    });

};


const prog = require('caporal');
prog
    .version('1.0.0')


    .command('generate')
    .option( '--spec <swagger_file>',
        'the location of the swagger file to debug',
        prog.STRING,
        null,
        true )
    .option( '--target <directory>',
        'target directory to create the micro-services in',
        prog.STRING,
        'micro-services',
        false )
    .option( '--template <directory>',
        'Directory containing custom template files',
        prog.STRING,
        null,
        false )
    .option( '--override <directory>',
        'Directory containing custom template files',
        prog.BOOLEAN,
        true)
    .option( '--standalone <boolean>',
        'Output each pin as a standalone service.',
        prog.BOOLEAN,
        true,
        true)
    .help('The generate command consumes a swagger spec and creates one or more Seneca modules/projects based on the Swagger operations.') // here our custom help for the `order` command
    .action(generate)

    .command('dump_templates')
    .option( '--target <directory>',
        'target directory to create the templates',
        prog.STRING,
        'swagger-seneca-codegen-templates',
        false )
    .help('The dump_template command writes the default moustache files to a directory. The default files can be customised and fed back into the generate command by using the --template option.')
    .action(dumpTemplates)


    .command('print_variables')
    .option( '--spec <swagger_file>',
                'the location of the swagger file to debug',
                prog.STRING,
                null,
                true )
    .help('This command consumes a Swagger spec and processes it as if module/project generation was to occur, however instead it prints the processed data to the console. This command is included to help you create your own template files.')
    .action(printVariables);

prog.parse(process.argv);