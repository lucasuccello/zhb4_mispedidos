jQuery.sap.declare("firma"), sap.ui.core.Control.extend("firma", {
    metadata: {
        properties: {
            width: {
                type: "int",
                defaultValue: 300
            },
            height: {
                type: "int",
                defaultValue: 200
            },
            fillStyle: {
                type: "string",
                defaultValue: "#fff"
            },
            strokeStyle: {
                type: "string",
                defaultValue: "#444"
            },
            lineWidth: {
                type: "float",
                defaultValue: 1.5
            },
            lineCap: {
                type: "string",
                defaultValue: "round"
            },
            penColor: {
                type: "string",
                defaultValue: "#333"
            },
            imageUrl: {
                type: "string",
                defaultValue: ""
            },
            signature: "string"
        }
    },
    renderer: function(e, t) {
        var i = t.getId();
        e.write('<div'), 
        e.writeControlData(t), 
        e.write(">"), 
        e.write('<canvas class="roundCorners" id="' + i + '_c" style=" margin: auto; display: block; border: 1px solid #c4caac" >'),
        e.write("</canvas>"), 
        e.write("</div>")
    },
    clear: function() {
        me.c.width = me.getWidth(), 
        me.c.height = me.getHeight();
        var e = me.c.getContext("2d");
        e.fillStyle = this.getFillStyle(), 
        e.strokeStyle = this.getStrokeStyle(), 
        e.lineWidth = this.getLineWidth(), 
        e.lineCap = this.getLineCap(), e.fillRect(0, 0, me.c.width, me.c.height);
        me._isEmpty = true;
    },
    getSignature: function() {
        return me.c.toDataURL("image/jpeg");
    },
    
    isEmpty: function() {
    	return me._isEmpty;
    },
    onAfterRendering: function() {
        function e() {
            me.c.removeEventListener("mousemove", n, !1), 
            me.c.removeEventListener("mouseup", a, !1), 
            me.c.removeEventListener("touchmove", n, !1), 
            me.c.removeEventListener("touchend", a, !1), 
            document.body.removeEventListener("mouseup", a, !1), 
            document.body.removeEventListener("touchend", a, !1)
        }

        function t(e) {
            var t, i;
            if (e.changedTouches && e.changedTouches[0]) {
              /* var n = me.c.offsetTop || 0,
                    a = me.c.offsetLeft || 0;
                t = e.changedTouches[0].pageX - a, 
                i = e.changedTouches[0].pageY - n */
                
            	t = e.changedTouches[0].clientX - (this.outerWidth - me.c.width)  / 2;
                i = e.changedTouches[0].clientY - (this.outerHeight - me.c.height)  / 2;
                
               // console.log('clientX: ' + e.changedTouches[0].clientX + ' clientY:' + e.changedTouches[0].clientY)

            } else {
        		 // 	e.layerX || 0 == e.layerX ? (t = e.layerX, i = e.layerY) : (e.offsetX || 0 == e.offsetX) && (t = e.offsetX, i = e.offsetY);
	        	t = e.offsetX;
	        	i = e.offsetY;
            	}
            return {
                x: t,
                y: i
            }
        }

        function i(e) {
            e.preventDefault(), 
            e.stopPropagation(), 
            me.c.addEventListener("mouseup", a, !1), 
            me.c.addEventListener("mousemove", n, !1), 
            me.c.addEventListener("touchend", a, !1), 
            me.c.addEventListener("touchmove", n, !1), 
            document.body.addEventListener("mouseup", a, !1), 
            document.body.addEventListener("touchend", a, !1), 
            empty = !1;
            me._isEmpty = false;
            var i = t(e);
            r.beginPath(), 
            d.push("moveStart"), 
            r.moveTo(i.x, i.y), 
            d.push(i.x, i.y), 
            u = i
        }

        function n(e) {
            e.preventDefault(), 
            e.stopPropagation();
            var i = t(e),
                n = {
                    x: (u.x + i.x) / 2,
                    y: (u.y + i.y) / 2
                };
            if (l) {
                var a = (c.x + u.x + n.x) / 3,
                    o = (c.y + u.y + n.y) / 3;
                d.push(a, o)
            } else l = !0;
            r.quadraticCurveTo(u.x, u.y, n.x, n.y), 
            d.push(n.x, n.y), 
            r.stroke(), 
            r.beginPath(), 
            r.moveTo(n.x, n.y), 
            c = n, 
            u = i
            me._isEmpty = false;
        }

        function a() {
            e(), 
            s = !1, 
            r.stroke(), 
            d.push("e"), 
            l = !1
        }
        this._isEmpty = true;
        me = this, 
        me.c = document.getElementById(this.getId() + "_c");
        var r = this.c.getContext("2d");
        if (me.c.width = this.getWidth(), me.c.height = this.getHeight(), r.fillStyle = this.getFillStyle(), r.strokeStyle = this.getStrokeStyle(), r.lineWidth = this.getLineWidth(), r.lineCap = this.getLineCap(), r.fillRect(0, 0, me.c.width, me.c.height), me.getImageUrl()) {
            var o = new Image;
            o.src = me.getImageUrl(), r.drawImage(o, 0, 0)
        }
        var s = !0,
            d = [],
            u = {}, c = {}, l = !1;
        me.c.addEventListener("touchstart", i, !1), 
        me.c.addEventListener("mousedown", i, !1)
    }
});