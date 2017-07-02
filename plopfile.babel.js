// https://www.npmjs.com/package/plop
// https://plopjs.com/documentation/#cli-usage
import inquirer from 'inquirer-directory';

import Settings from './config/settings'

// config...

// home of templates... Settings.templates.example
const exampleTemplatePath = Settings.templates.example;

// default paths to copy things from... output to Settings.folders.examples;
const defaultExamplePath = Settings.folders.examples;

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
        message: 'What is name of the new example?',
        validate: required('name'),
      },
      {
        type: 'confirm',
        name: 'needPath',
        message: 'Should I place the new example in examples/ directory?',
        default: true,
      },
      {
        type: 'directory',
        name: 'path',
        message: 'Where shall I create the new example?',
        basePath: defaultExamplePath,
        default: '',
        when: (answers) => answers.needPath,
      }
    ],
    // stuff to do with the input data...
    // data.name
    actions: (data) => {
      // create variables that can be accessed within the template files.
      // determine path from the input data above...
      plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}'+defaultExamplePath+'{{/if}}{{ dashCase name }}');

      // where to put these in the end...
      plop.addPartial('fullPath', './{{> path}}');

      // stuff that happens with data
      const actions = [

        // copy typescript application
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.ts',
          templateFile: exampleTemplatePath+'.ts',
          abortOnFail: true,
        },
        // copy js index entry point
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.js',
          templateFile: exampleTemplatePath+'.js',
          abortOnFail: true,
        },
        // copy readme file
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.js',
          templateFile: exampleTemplatePath+'.js',
          abortOnFail: true,
        }
      ];


      // copy less, scss file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.less',
        templateFile: exampleTemplatePath+'.less',
        abortOnFail: true,
      });

      // copy css file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.css',
        templateFile: exampleTemplatePath+'.css',
        abortOnFail: true,
      });


      // copy html or pug file
      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.html',
        templateFile: exampleTemplatePath+'.html',
        abortOnFail: true,
      });

      actions.push({
        type: 'add',
        path: '{{> fullPath}}/{{dashCase name}}.pug',
        templateFile: exampleTemplatePath+'.pug',
        abortOnFail: true,
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
