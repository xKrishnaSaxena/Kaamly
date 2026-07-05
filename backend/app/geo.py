from geoalchemy2.elements import WKTElement


def point(lat: float, lng: float) -> WKTElement:
    """Build a PostGIS geography point from lat/lng.

    Note WKT order is POINT(X Y) = POINT(lng lat).
    """
    return WKTElement(f"POINT({lng} {lat})", srid=4326)
