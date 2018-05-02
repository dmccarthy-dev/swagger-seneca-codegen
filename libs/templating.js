'use strict';

const fs     = require('fs'),
    path     = require('path'),
    mustache = require('mustache');


/**
 *
 * Dumps the built in templates to a target directory.
 * These templates can be modified to users own tastes and
 * reused in the generate function.
 *
 * @param {string} templateDir - the directory containing templates
 * @param {string} targetDir - the target directory that
 */
const dumpTemplates = function ( templateDir, targetDir ) {

    if ( !fs.existsSync( targetDir )){
        fs.mkdirSync( targetDir );
    }

    fs.readdir( templateDir, function( err, filenames ) {

        if (err) {
            throw Error( err );
        }

        filenames.forEach(function( filename ) {

            const source = path.join( templateDir, filename);
            const target = path.join( targetDir, filename);

            fs.createReadStream( source ).pipe(fs.createWriteStream( target ));
        });
    });

};


/**
 *
 * @param {object} service
 * @param {string} templateDir
 * @param {string} targetDir
 * @param {boolean} override
 * @param {boolean} standalone
 */
const createService = function ( service, templateDir, targetDir, override, standalone ) {

    if (!fs.existsSync( targetDir )){
        fs.mkdirSync( targetDir );
    }

    if (standalone && !fs.existsSync( path.join( targetDir, service.dirname ) ) ){
        fs.mkdirSync(  path.join( targetDir, service.dirname ) );
    }

    fs.readdir( templateDir, function( err, filenames ) {

        if (err) {
            throw Error( err );
        }

        filenames.forEach(function( filename ) {
            fs.readFile( path.join( templateDir, filename ), 'utf-8', function( err, content ) {
                if (err) {
                    throw Error( err );
                }

                const targetFile = identifyTargetFile( targetDir, service, filename, standalone );
                if ( !fs.existsSync( targetFile ) || override ){
                    fs.writeFileSync( targetFile, mustache.render( content, service ) );
                }
            });
        });
    });

};


/**
 *
 * @param targetDir
 * @param service
 * @param filename
 * @param standalone
 *
 * @returns {*}
 */
const identifyTargetFile = function ( targetDir, service, filename, standalone ){

    if ( standalone ){
        return path.join( targetDir, service.dirname, filename.replace( /.mustache/, '' ) );
    }

    if ( filename === 'index.js.mustache' ){
        return path.join( targetDir, service.name + '.js' );
    }

    return path.join( targetDir, filename.replace( /.mustache/, '' ) );
};


module.exports.createService = createService;
module.exports.dumpTemplates = dumpTemplates;