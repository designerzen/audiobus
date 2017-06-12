/*

	gulpfile.babel.js
	===========
	Rather than manage one giant configuration file responsible
	for creating multiple tasks, each task has been broken out into
	its own file in utilities/tasks.

	Any files in that directory get	automatically required below.

	To add a new task, simply add a new task file that directory.

	To create a series of tasks, add a new file to gulp/jobs

	utilities/jobs/default.js specifies the default set of tasks to run
	when you run `gulp`.

	Tasks ========================================================

*/

import Package      from './package';
import Settings     from './config/settings';

import requireDir 	from 'require-dir';

// Require all tasks in folders, including subfolders
//requireDir( Settings.folders.jobs, { recurse: false } );
requireDir( Settings.folders.tasks, { recurse: false } );
