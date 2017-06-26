const hasPerformance:boolean = window.performance && window.performance.now && window.performance.now() > 0;

const TimeNow = function():number
{
  return hasPerformance ? window.performance.now() : Date.now();
}


export default TimeNow;
