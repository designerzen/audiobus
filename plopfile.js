// https://www.npmjs.com/package/plop
import inquirer from 'inquirer-directory';

const pathTemplate = "./client/template/";
const pathComponent = pathTemplate+"component/";
const pathRoute = pathTemplate+"route/";
const pathService = pathTemplate+"service/";

function required(name) {

  return (value) => {
    if (!value) {
      return `${name} is required`;
    }

    return true;
  }
}

module.exports = (plop) => {

  // DETERMINE DIRECTORY -------------------------------------------------------
  plop.addPrompt('directory', inquirer);


  // ===========================================================================

  // COMPONENT GENERATOR -------------------------------------------------------
  plop.setGenerator('component', {
    description: 'Create a new component',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is name of the new component?',
        validate: required('name'),
      },
      {
        type: 'confirm',
        name: 'needPath',
        message: 'Should I place new component in components/ directory?',
        default: false,
      },
      {
        type: 'directory',
        name: 'path',
        message: 'Where to put new component?',
        basePath: pathComponent,
        default: '',
        when: (answers) => answers.needPath,
      }
    ],
    actions: () => {
      plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}components/{{/if}}{{ dashCase name }}');
      plop.addPartial('fullPath', './client/app/{{> path}}');

      return [
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.js',
          templateFile: pathComponent+'component.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.component.js',
          templateFile: pathComponent+'component.component.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.html',
          templateFile: pathComponent+'component.html',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.controller.js',
          templateFile: pathComponent+'component.controller.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.scss',
          templateFile: pathComponent+'component.scss',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.readme.txt',
          templateFile: pathComponent+'component.readme.txt',
          abortOnFail: false,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.spec.js',
          templateFile: pathComponent+'component.spec.js',
          abortOnFail: true,
        },
      ]
    }
  });

  // ===========================================================================
  // ROUTE GENERATOR -------------------------------------------------------
  plop.setGenerator('route', {
    description: 'Create a new route',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is name of the new route?',
        validate: required('name'),
      },
      {
        type: 'confirm',
        name: 'needPath',
        message: 'Should I place new route in routes/ directory, or should we place it somewhere else?',
        default: false,
      },
      {
        type: 'directory',
        name: 'path',
        message: 'Where to put new route?',
        basePath: pathRoute,
        default: '',
        when: (answers) => answers.needPath,
      }
    ],
    actions: () => {
      plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}routes/{{/if}}{{ dashCase name }}');
      plop.addPartial('fullPath', './client/app/{{> path}}');

      return [
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.js',
          templateFile: pathRoute+'route.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.component.js',
          templateFile: pathRoute+'route.component.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.html',
          templateFile: pathRoute+'route.html',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.controller.js',
          templateFile: pathRoute+'route.controller.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.scss',
          templateFile: pathRoute+'route.scss',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.readme.txt',
          templateFile: pathRoute+'route.readme.txt',
          abortOnFail: false,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.spec.js',
          templateFile: pathRoute+'route.spec.js',
          abortOnFail: true,
        },
      ]
    }
  });


  // ===========================================================================
  // SERVICE GENERATOR -------------------------------------------------------
  plop.setGenerator('service', {
    description: 'Create a new service',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is name of the new service?',
        validate: required('name'),
      },
      {
        type: 'confirm',
        name: 'needPath',
        message: 'Should I place new service in services/ directory, or it should be placed somewhere else?',
        default: false,
      },
      {
        type: 'directory',
        name: 'path',
        message: 'Where to put new service?',
        basePath: pathService,
        default: '',
        when: (answers) => answers.needPath,
      }
    ],
    actions: () => {
      plop.addPartial('path', '{{#if path}}{{ path }}/{{else}}services/{{/if}}{{ dashCase name }}');
      plop.addPartial('fullPath', './client/app/{{> path}}');

      return [
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.js',
          templateFile: pathService+'service.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.service.js',
          templateFile: pathService+'service.service.js',
          abortOnFail: true,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.readme.txt',
          templateFile: pathService+'service.readme.txt',
          abortOnFail: false,
        },
        {
          type: 'add',
          path: '{{> fullPath}}/{{dashCase name}}.spec.js',
          templateFile: pathService+'service.spec.js',
          abortOnFail: true,
        },
      ]
    }
  });


  // ===========================================================================

};
