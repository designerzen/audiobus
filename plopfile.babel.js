// https://www.npmjs.com/package/plop
// https://plopjs.com/documentation/#cli-usage
import inquirer from 'inquirer-directory';

import Settings from './config/settings'

const templateName = "example";

// home of templates... Settings.templates.example
const exampleTemplatePath = Settings.templates[templateName] ;

// default paths to copy things from... output to Settings.folders.examples;
const destinationExampleTemplatePath = Settings.folders.examples + '/';

// const pathComponent = pathTemplate+"component/";
// const pathRoute = pathTemplate+"route/";
// const pathService = pathTemplate+"service/";

function required(name) {

  return (value) => {
    if (!value) {
      return `${name} is required`;
    }

    return true;
  }
}

//const plops = (plop) => {
module.exports = (plop) => {
  // addHelper, addPartial, addPrompt, setGenerator

  // DETERMINE DIRECTORY -------------------------------------------------------
  plop.addPrompt('directory', inquirer);

  // ===========================================================================
  plop.setGenerator('example', {
    // describe the plop
    description: 'Create all the files required to make a new example',
    // stuff that gets asked
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is name of your new audiobus project?',
        validate: required('name'),
      },
      {
        type: 'confirm',
        name: 'needPath',
        message: 'Should I place the new example in "' + destinationExampleTemplatePath+'" directory?',
        default: true,
      },
      {
        type: 'directory',
        name: 'path',
        message: 'Where shall I create the new example?',
        basePath: destinationExampleTemplatePath,
        default: '',
        when: (answers) => !answers.needPath,
      }
    ],
    // stuff to do with the input data...
    // data.name
    actions: (data) => {
      // create variables that can be accessed within the template files.
      // determine path from the input data above...
      plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}'+destinationExampleTemplatePath+'{{/if}}{{ dashCase name }}');

      // where to put these in the end...
      plop.addPartial('fullPath', './{{> path}}');

      // stuff that happens with data
      const actions = [

        // copy typescript application
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.ts',
          templateFile: exampleTemplatePath + templateName+'.ts',
          abortOnFail: true,
        },
        // copy js index entry point
        {
          type: 'add',
          path: '{{> fullPath}}/index.js',
          templateFile: exampleTemplatePath+'index.js',
          abortOnFail: true,
        },
        // copy readme file
        {
          type: 'add',
          path: '{{> fullPath}}/readme.txt',
          templateFile: exampleTemplatePath+'readme.txt',
          abortOnFail: false,
        }
      ];


      // copy less, scss file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.less',
        templateFile: exampleTemplatePath + templateName +'.less',
        abortOnFail: false,
      });

      // copy css file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.css',
        templateFile: exampleTemplatePath + templateName +'.css',
        abortOnFail: false,
      });


      // copy html or pug file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.html',
        templateFile: exampleTemplatePath + templateName +'.html',
        abortOnFail: false,
      });

      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.pug',
        templateFile: exampleTemplatePath + templateName +'.pug',
        abortOnFail: false,
      });

      // expose
      return actions;
    }
  });
  //
  // // COMPONENT GENERATOR -------------------------------------------------------
  //
  // plop.setGenerator('component', {
  //   description: 'Create a new component',
  //   prompts: [
  //     {
  //       type: 'input',
  //       name: 'name',
  //       message: 'What is name of the new component?',
  //       validate: required('name'),
  //     },
  //     {
  //       type: 'confirm',
  //       name: 'needPath',
  //       message: 'Should I place new component in components/ directory?',
  //       default: false,
  //     },
  //     {
  //       type: 'directory',
  //       name: 'path',
  //       message: 'Where to put new component?',
  //       basePath: pathComponent,
  //       default: '',
  //       when: (answers) => answers.needPath,
  //     }
  //   ],
  //   actions: () => {
  //     plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}components/{{/if}}{{ dashCase name }}');
  //     plop.addPartial('fullPath', './client/app/{{> path}}');
  //
  //     return [
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.js',
  //         templateFile: pathComponent+'component.js',
  //         abortOnFail: true,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.component.js',
  //         templateFile: pathComponent+'component.component.js',
  //         abortOnFail: true,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.html',
  //         templateFile: pathComponent+'component.html',
  //         abortOnFail: true,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.controller.js',
  //         templateFile: pathComponent+'component.controller.js',
  //         abortOnFail: true,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.scss',
  //         templateFile: pathComponent+'component.scss',
  //         abortOnFail: true,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.readme.txt',
  //         templateFile: pathComponent+'component.readme.txt',
  //         abortOnFail: false,
  //       },
  //       {
  //         type: 'add',
  //         path: '{{> fullPath}}/{{dashCase name}}.spec.js',
  //         templateFile: pathComponent+'component.spec.js',
  //         abortOnFail: true,
  //       },
  //     ]
  //   }
  // });

};

//export default plops;
