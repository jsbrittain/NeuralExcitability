/*

Dr John-Stuart Brittain
Birmingham University, UK
Last revision 2 June 2020

*/

function ArmSim() {

	this.canvas = document.querySelector('#armSim');
	this.resscale = 3;		// Resolution scaling only (default 300px wide)
	this.canvas.width = this.resscale*this.canvas.width;
	this.canvas.height = this.resscale*this.canvas.height;

	this.display = {
		spring_force : false,
		displacement : true
	};

	this.c = this.canvas.getContext('2d');
	this.c.font = (this.resscale*6) + "px Arial";

	this.xoffset = this.canvas.width/2.0;
	this.yoffset = this.canvas.height/2.0;
	this.colorFill = "black";//'C4CDFF';
	this.colorStroke = "black";//'3C5AFF';

	// ARM model
	this.arm = {
		elbow : { x: 675, y : 225, angle: -(60.0)*Math.PI/180.0 },
		humerus : { length: 100, angle: undefined },
		forearm : { length: 100 },
		bicep : { offset_x: undefined, offset_y: undefined, offset: 7 }
	};
	this.arm.humerus.angle = this.arm.elbow.angle;
	this.arm.humerus.x = this.arm.elbow.x - this.arm.humerus.length*Math.cos(this.arm.humerus.angle);
	this.arm.humerus.y = this.arm.elbow.y + this.arm.humerus.length*Math.sin(this.arm.humerus.angle);
	this.arm.bicep.offset_x = this.arm.bicep.offset*Math.sin(this.arm.humerus.angle);
	this.arm.bicep.offset_y = this.arm.bicep.offset*Math.cos(this.arm.humerus.angle);

	// Motor unit array
	this.MUbar = {
		xoffset : [ 50, 50 ],
		yoffset : [ 200, 325 ],
		xspacing : [ 4, 4 ],
		dt : [ 0.25, 0.25 ],
		MUs : [ ]		// 2D for two muscles
	};
	Nunits = 100;
	for (var i = 0; i < Nunits; i++)
		this.MUbar.MUs[i] = [0,0];

	// Motor Unit action potential time-series
	this.MUAPs = {
		N : Math.round( this.MUbar.MUs.length/this.MUbar.dt[0] ),
		APs : []
	};
	for (var i = 0; i < this.MUAPs.N; i++)
		this.MUAPs.APs[i] = [0, 0];
	this.MUAPscaling = [ 1.0, 0.5 ];

	// Treat elbow forces as springs
	this.elbow = {
		forces : [],
		resultant_force : new Array(this.MUAPs.N),
		resultant_displacement : new Array(this.MUAPs.N)
	};
	for (var i = 0; i < this.MUAPs.N; i++) {
		this.elbow.forces[i] = new Array(2);
	}

	// Draw parameters
	this.draw_sample = 0;
	this.draw_N = this.MUAPs.N;
	this.draw_time = undefined;
	this.draw_start_time = Date.now();
	this.draw_rate = 0.01;

	// Target time-series
	this.target = {
			x: [ ],
			y: [ ],
			radius: [ ],
			colour: [ ]
		};
	this.targetangle = new Array(this.MUAPs.N);
	this.targetradius = new Array(this.MUAPs.N);
	this.timeontarget = 0.0;

	this.hitTime = 0;
	this.hitCount = 0;
	this.hitLocation = 0;
	this.hitTargetCount = 10;
	this.hitMisses = 0;
	this.hitLocs = [];
	this.onScreenResult = "";
	this.onScreenText = "Activate motor-units to maintain target pointing";

	this.mousedown = function( event ) {
		const rect = this.canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left)*this.canvas.width/rect.width;
	    const y = (event.clientY - rect.top)*this.canvas.height/rect.height;

	    // Off-canvas
		if (( x < 0 ) || ( x > this.canvas.width ) || ( y < 0 ) || ( y > this.canvas.height) )
			return;

		// Find clicked-on AP and switch state
		for ( var n = 0; n < 2; n++ ) {
			if ( (y < (this.MUbar.yoffset[n]+15)) && (y > (this.MUbar.yoffset[n]-15)) ) {
				var index = Math.round((x - this.MUbar.xoffset[n]-0.5*this.MUbar.xspacing[n])/this.MUbar.xspacing[n]);
				//console.log(this.MUbar.MUs[index][n]);
				this.MUbar.MUs[index][n] = 1 - this.MUbar.MUs[index][n];
			}
		}

		// Recalculate response
		this.calcMUAPresponse();
	}

	this.setNoTargets = function() {
		this.target = {
			x: [ ],
			y: [ ],
			radius: [ ],
			colour: [ ]
		}
		for (var i = 0; i < this.MUAPs.N; i++) {
			this.targetangle[i] = this.arm.elbow.angle;
			this.targetradius[i] = this.target.radius[0]*Math.PI/180;
		}
		this.calcMUAPresponse();
	}

	this.setOneTarget = function() {
		this.target = {
			x: [ this.arm.elbow.x+this.arm.forearm.length ],
			y: [ this.arm.elbow.y ],
			radius: [ 5.0 ],
			colour: [ "blue" ]
		}
		for (var i = 0; i < this.MUAPs.N; i++) {
			if (( i > (this.MUAPs.N/3) ) && ( i < (2*this.MUAPs.N/3) )) {
				this.targetangle[i] = 0;
				this.targetradius[i] = this.target.radius[0]*Math.PI/180;
			}
			else {
				this.targetangle[i] = this.arm.elbow.angle;
				this.targetradius[i] = this.target.radius[0]*Math.PI/180;
			}
		}
		this.calcMUAPresponse();
	}

	this.setTwoTargets = function() {
		this.target = {
			x: [ this.arm.elbow.x+this.arm.forearm.length*Math.cos(Math.PI/8), this.arm.elbow.x+this.arm.forearm.length*Math.cos(-Math.PI/8) ],
			y: [ this.arm.elbow.y+this.arm.forearm.length*Math.sin(Math.PI/8), this.arm.elbow.y+this.arm.forearm.length*Math.sin(-Math.PI/8) ],
			radius: [ 5.0, 5.0 ],
			colour: [ "green", "blue" ]
		}
		for (var i = 0; i < this.MUAPs.N; i++) {
			if (( i > (this.MUAPs.N*0.2) ) && ( i < (this.MUAPs.N*0.4) )) {
				this.targetangle[i] = Math.PI/8;
				this.targetradius[i] = this.target.radius[0]*Math.PI/180;
			}
			else if ( i > (this.MUAPs.N*0.6) && ( i < (this.MUAPs.N*0.8) ) ) {
				this.targetangle[i] = -Math.PI/8;
				this.targetradius[i] = this.target.radius[1]*Math.PI/180;
			}
			else {
				this.targetangle[i] = this.arm.elbow.angle;
				this.targetradius[i] = this.target.radius[0]*Math.PI/180;
			}
		}
		this.calcMUAPresponse();
	}

	this.resetTimer = function() {
		//
	}

	this.init = function() {
		//this.onScreenText = "";
		//this.resetTimer();
		this.resetMUs();
		this.MUbar.MUs[15][0] = 1;
		this.setOneTarget();
		this.calcMUAPresponse();
	}

	this.resetMUs = function() {
		for ( var n = 0; n < 2; n++ ) {
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				this.MUbar.MUs[k][n] = 0;
			}
		}
		this.calcMUAPresponse();
	}

	this.randomMUs = function() {
		for ( var n = 0; n < 2; n++ ) {
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				if ( Math.random() < 0.33 )
					this.MUbar.MUs[k][n] = 1;
				else
					this.MUbar.MUs[k][n] = 0;
			}
		}
		this.calcMUAPresponse();
	}

	this.restartTime = function() {
		this.draw_time = 0;
		this.draw_sample = 0;
		this.draw_start_time = Date.now();
	}

	this.setDrawRate = function( rate ) {
		armSim.draw_rate = rate;
		this.restartTime();
	}
	
	this.calcMUAPresponse = function() {
		var tau = 2.5;
		var max_contraction = 5.0;
		
		// Reset
		for ( var n = 0; n < 2; n++ ) {
			// Reset MUAPs
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				this.MUAPs.APs[tn][n] = 0;
			}
		}
		// Repeat for each muscle
		for ( var n = 0; n < 2; n++ ) {
			// Recurse motor units for each point in time
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				// Only include time-points past the MU activation time
				if ( this.MUbar.MUs[k][n] == 1 ) {
					firingtime = k;//*this.MUbar.dt[n]);
					firingN = Math.round(k/this.MUbar.dt[n]);
					for ( var tn = firingN; tn < this.MUAPs.N; tn++ ) {
						// Add MUAP for each unit in turn
						t = tn*this.MUbar.dt[n];
						this.MUAPs.APs[tn][n] = Math.min( max_contraction, this.MUAPs.APs[tn][n] + (1-Math.pow(0.025,t-firingtime))*Math.exp( -(t-firingtime)/tau ) );
					}
				}
			}
		}
		// Calculate force on joint and joint angle
		var resultant_displacement = 0;
		var springk = 0.05;
		var springm = 0.1;
		this.timeontarget = 0.0;
		for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
			// Calculate force applied by both muscles at that moment in time
			//for ( var n = 0; n < 2; n++ )
			this.elbow.forces[tn][0] = this.MUAPscaling[0]*this.MUAPs.APs[tn][0] - springk*resultant_displacement;
			this.elbow.forces[tn][1] = this.MUAPscaling[1]*this.MUAPs.APs[tn][1] + springk*resultant_displacement;
			this.elbow.resultant_force[tn] = this.elbow.forces[tn][0] - this.elbow.forces[tn][1];
			// Clamp displacement at zero (cannot rotate arm backwards any further)
			this.elbow.resultant_displacement[tn] = Math.max( 0, resultant_displacement + this.elbow.resultant_force[tn]*Math.sqrt( 1/(springm*springk) )*this.MUbar.dt[0] );
			resultant_displacement = this.elbow.resultant_displacement[tn];
			// Calculate time-on-target
			if ( this.target.x.length > 0 ) {
				var elbowangle = Math.min( Math.PI, this.arm.elbow.angle+0.1*this.elbow.resultant_displacement[tn] );
				if ( Math.abs(elbowangle - this.targetangle[tn]) < this.targetradius[tn] )
					this.timeontarget += 1;
			}
		}
		this.timeontarget = 100*this.timeontarget / this.MUAPs.N;
	}

	this.drawnow = function() {

		this.draw_time = Date.now() - this.draw_start_time;
		this.draw_sample = Math.round( this.draw_rate*this.draw_time/this.MUbar.dt[0] );
		if ( this.draw_sample >= this.draw_N ) {
			this.restartTime();
		}

		var resscale = this.resscale;

		// Reset Canvas
		this.c.clearRect(0,0,this.canvas.width,this.canvas.height);
		this.c.fillStyle = this.colorFill;
		this.c.strokeStyle = this.colorStroke;
		this.c.lineWidth = 2;

		// Draw ARM --- bounding box
		this.c.beginPath();
		this.c.rect( this.arm.elbow.x-150, 25, 350, this.canvas.height-50 );
		this.c.stroke();

		// Draw ARM --- upper arm (humerus)
		this.c.moveTo(this.arm.humerus.x,this.arm.humerus.y);
		this.c.lineTo(this.arm.elbow.x,this.arm.elbow.y);
		this.c.stroke();

		// Draw ARM --- lower arm (radius and ulna)
		var elbow_angle = Math.min( Math.PI, this.arm.elbow.angle+0.1*this.elbow.resultant_displacement[this.draw_sample] );
		this.c.moveTo(this.arm.elbow.x,this.arm.elbow.y);
		this.c.lineTo(this.arm.elbow.x + this.arm.forearm.length*Math.cos(elbow_angle),this.arm.elbow.y - this.arm.forearm.length*Math.sin(elbow_angle));
		this.c.stroke();

		// Draw ARM --- muscles
		this.c.beginPath();
		this.c.strokeStyle = "rgb(" + 255*Math.min(1,this.MUAPscaling[1]*this.MUAPs.APs[this.draw_sample][1]) + ", 0, 0)";
		this.c.lineWidth = Math.max(0.5,4*Math.min(1,this.MUAPscaling[1]*this.MUAPs.APs[this.draw_sample][1]));
		this.c.beginPath();
		this.c.moveTo(this.arm.humerus.x + this.arm.bicep.offset_x,this.arm.humerus.y + this.arm.bicep.offset_y);
		this.c.lineTo(this.arm.elbow.x + this.arm.bicep.offset_x,this.arm.elbow.y + this.arm.bicep.offset_y);
		this.c.stroke();

		this.c.beginPath();
		this.c.strokeStyle = "rgb(" + 255*Math.min(1,this.MUAPscaling[0]*this.MUAPs.APs[this.draw_sample][0]) + ", 0, 0)";
		this.c.lineWidth = Math.max(0.5,4*Math.min(1,this.MUAPscaling[0]*this.MUAPs.APs[this.draw_sample][0]));
		this.c.moveTo(this.arm.humerus.x - this.arm.bicep.offset_x,this.arm.humerus.y - this.arm.bicep.offset_y);
		this.c.lineTo(this.arm.elbow.x - this.arm.bicep.offset_x,this.arm.elbow.y - this.arm.bicep.offset_y);
		this.c.stroke();
		this.c.strokeStyle = this.colorStroke;
		this.c.lineWidth = 2;

		// Draw ARM --- Elbow (overdraws other structures)
		this.c.beginPath();
		this.c.fillStyle = "white";
		this.c.moveTo(this.arm.elbow.x+10.0,this.arm.elbow.y);
		this.c.arc(this.arm.elbow.x,this.arm.elbow.y,10,0,Math.PI*2,false);
		this.c.fill();
		this.c.stroke();

		// Draw TARGETs
		this.c.strokeStyle = "black";
		for ( var k = 0; k < this.target.x.length; k++ ) {
			this.c.fillStyle = this.target.colour[k];
			this.c.beginPath();
			this.c.moveTo(this.target.x[k]+this.target.radius[k],this.target.y[k]);
			this.c.arc(this.target.x[k],this.target.y[k],this.target.radius[k],0,Math.PI*2,false);
			this.c.fill();
			this.c.stroke();
		}
		this.c.fillStyle = this.colorFill;
		this.c.strokeStyle = this.colorStroke;

		// Draw motor unit activators
		var symbol = "";
		this.c.beginPath();
		this.c.fillStyle = "black";
		this.c.fillText(this.onScreenText, resscale*4, resscale*8);
		this.onScreenResult = "Time-on-target = " + this.timeontarget + "%";
		this.c.fillText(this.onScreenResult, resscale*4, resscale*16);
		for ( var n = 0; n < 2; n++ ) {
			for ( var k = 0; k < this.MUbar.MUs.length; k++ ) {
				if ( this.MUbar.MUs[k][n] == 1 ) {
					this.c.fillStyle = "black";
					symbol = "|";
				} else {
					this.c.fillStyle = "green";
					symbol = ".";
				}
				this.c.fillText(symbol, this.MUbar.xoffset[n] + this.MUbar.xspacing[n]*k, this.MUbar.yoffset[n]);
			}
		}

		// Draw MUAP train
		var yscaling = 15.0;
		var xoffset = 50;
		var yoffset = [ this.MUbar.yoffset[0]-30, this.MUbar.yoffset[1]-30 ];
		this.c.beginPath();
		this.c.strokeStyle = "black";
		this.c.lineWidth = 1;
		for ( var n = 0; n < 2; n++ ) {
			this.c.moveTo( xoffset, yoffset[n] );
			// Only include time-points past the MU activation time
			for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
				this.c.lineTo( xoffset + this.MUbar.xspacing[0]*tn*this.MUbar.dt[n], yoffset[n] - yscaling*this.MUAPs.APs[tn][n] );
			}
		}
		this.c.stroke();

		// Resultant force
		if ( this.display.spring_force ) {
			this.c.moveTo( 50, 350 );
			this.c.lineTo( 50 + this.MUbar.xspacing[0]*(this.MUAPs.N-1)*this.MUbar.dt[0], 350 );
			for ( var n = 0; n < 2; n++ ) {
				this.c.moveTo( 50, 350 );
				// Only include time-points past the MU activation time
				for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
					this.c.lineTo( 50 + this.MUbar.xspacing[0]*tn*this.MUbar.dt[n], 350 - 10*this.elbow.resultant_force[tn] );
				}
			}
			this.c.stroke();
		}

		if ( this.display.displacement ) {
			// Target displacement
			this.c.beginPath();
			this.c.strokeStyle = "Coral";
			this.c.lineWidth = 0.5;
			var yoffset_disp = yoffset[1]+(yoffset[1]-yoffset[0]);
			this.c.moveTo( 50, yoffset_disp );
			this.c.lineTo( 50 + this.MUbar.xspacing[0]*(this.MUAPs.N-1)*this.MUbar.dt[0], yoffset_disp );
			for ( var n = 0; n < 2; n++ ) {
				this.c.moveTo( 50, yoffset_disp );
				// Only include time-points past the MU activation time
				for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
					this.c.lineTo( 50 + this.MUbar.xspacing[0]*tn*this.MUbar.dt[n], yoffset_disp - 10*this.targetangle[tn] -10 );
				}
			}
			this.c.stroke();

			// Resultant displacement
			this.c.beginPath();
			this.c.strokeStyle = "black";
			this.c.lineWidth = 1;
			var yoffset_disp = yoffset[1]+(yoffset[1]-yoffset[0]);
			for ( var n = 0; n < 2; n++ ) {
				this.c.moveTo( 50, yoffset_disp );
				// Only include time-points past the MU activation time
				for ( var tn = 0; tn < this.MUAPs.N; tn++ ) {
					this.c.lineTo( 50 + this.MUbar.xspacing[0]*tn*this.MUbar.dt[n], yoffset_disp - 1*this.elbow.resultant_displacement[tn] );
				}
			}
			this.c.fillStyle = "black";
			this.c.fillText("Displacement / ", xoffset, yoffset_disp-30);
			this.c.stroke();
			this.c.beginPath();
			this.c.fillStyle = "Coral";
			this.c.fillText("Target", xoffset+125, yoffset_disp-30);
			this.c.stroke();
		}

		// Timer
		this.c.moveTo( 50 + this.MUbar.xspacing[0]*this.draw_sample*this.MUbar.dt[0], 100 );
		this.c.lineTo( 50 + this.MUbar.xspacing[0]*this.draw_sample*this.MUbar.dt[0], 450 );
		this.c.stroke();

		// Labels
		this.c.fillStyle = "black";
		this.c.fillText("Bicep", xoffset, yoffset[0]-30);
		this.c.fillText("Tricep", xoffset, yoffset[1]-30);

	}

}



// *** Main code block ***

var armSim = new ArmSim();

uiResetAPs = function( ) {
	armSim.init();
}

uiRandomAPs = function( ) {
	armSim.randomMUs();
}

uiRestart = function() {
	armSim.restartTime();
}

uiSetUpdate = function( speed ) {
	armSim.setDrawRate( speed );
}

uiSetNoTargets = function() {
	armSim.setNoTargets();
}

uiSetOneTarget = function() {
	armSim.setOneTarget();
}

uiSetTwoTargets = function() {
	armSim.setTwoTargets();
}

window.addEventListener('resize',
	function() {
		armSim.init();
	})

addEventListener('mousemove',
	function(event) {
		//armSim.mousemove(event);
	});

addEventListener('mousedown',
	function(event) {
		armSim.mousedown(event);
	});

animate = function() {
	requestAnimationFrame(animate);
	armSim.drawnow();
}

armSim.init();
animate();
